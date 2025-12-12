# enrichment_service.py - Ntropy Transaction Enrichment Service
# Handles TrueLayer → Ntropy → Budget Classification pipeline
# Version: 1.1 - With ntropy-sdk support

import os
import hashlib
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# Ntropy SDK import
NTROPY_AVAILABLE = False
NtropySDK = None
NtropyTransactionInput = None

try:
    from ntropy_sdk import SDK
    from ntropy_sdk.transactions import TransactionInput
    NtropySDK = SDK
    NtropyTransactionInput = TransactionInput
    NTROPY_AVAILABLE = True
    print("[EnrichmentService] Ntropy SDK loaded successfully")
except ImportError as e:
    print(f"[EnrichmentService] Warning: ntropy-sdk not available ({e}), running in fallback mode")


# ============== Pydantic Models for Type Safety ==============

class TrueLayerIngestModel(BaseModel):
    """Validated input from TrueLayer transaction data"""
    transaction_id: str
    description: str
    amount: float
    currency: str = "GBP"
    transaction_type: Optional[str] = None  # DEBIT/CREDIT
    transaction_category: Optional[str] = None
    transaction_classification: Optional[List[str]] = None
    timestamp: str  # ISO format
    
class NtropyOutputModel(BaseModel):
    """Output model after Ntropy enrichment"""
    transaction_id: str
    original_description: str
    merchant_clean_name: Optional[str] = None
    merchant_logo_url: Optional[str] = None
    merchant_website_url: Optional[str] = None
    labels: List[str] = Field(default_factory=list)
    is_recurring: bool = False
    recurrence_frequency: Optional[str] = None
    recurrence_day: Optional[int] = None
    amount_cents: int
    entry_type: str  # 'incoming' or 'outgoing'
    budget_category: str  # 'debt', 'fixed', 'discretionary'
    transaction_date: str


# ============== Classification Constants ==============

# Labels that indicate potential debt payments
DEBT_LABELS = [
    'loan', 'mortgage', 'finance', 'bnpl', 'buy now pay later',
    'credit card', 'overdraft', 'klarna', 'clearpay', 'afterpay',
    'laybuy', 'paypal credit', 'very pay', 'littlewoods', 'studio',
    'car finance', 'personal loan', 'debt collection', 'debt recovery'
]

# Labels that indicate fixed/recurring costs
FIXED_COST_LABELS = [
    'utilities', 'utility', 'gas', 'electric', 'electricity', 'water',
    'council tax', 'insurance', 'home insurance', 'car insurance',
    'life insurance', 'health insurance', 'subscription', 'membership',
    'gym', 'streaming', 'netflix', 'spotify', 'amazon prime', 'disney+',
    'rent', 'mortgage payment', 'broadband', 'internet', 'phone', 'mobile',
    'tv license', 'childcare', 'nursery', 'school fees'
]

# Labels for discretionary spending
DISCRETIONARY_LABELS = [
    'food', 'dining', 'restaurant', 'takeaway', 'fast food', 'coffee',
    'shopping', 'retail', 'clothing', 'electronics', 'entertainment',
    'leisure', 'travel', 'holiday', 'gambling', 'betting', 'lottery'
]


# ============== Enrichment Service ==============

class EnrichmentService:
    """
    Handles the full transaction enrichment lifecycle:
    ingest → convert → enrich → classify
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """Initialize the Ntropy SDK with the provided API key"""
        self.api_key = api_key or os.environ.get("NTROPY_API_KEY")
        self.sdk = None
        
        if NTROPY_AVAILABLE and self.api_key and NtropySDK:
            try:
                self.sdk = NtropySDK(self.api_key)
                print("[EnrichmentService] Ntropy SDK initialized successfully")
            except Exception as e:
                print(f"[EnrichmentService] Failed to initialize Ntropy SDK: {e}")
                self.sdk = None
        else:
            print("[EnrichmentService] Running in fallback mode (no Ntropy enrichment)")
    
    def normalize_truelayer_transaction(self, raw_tx: Dict[str, Any]) -> TrueLayerIngestModel:
        """
        Phase 1: Normalize raw TrueLayer transaction data
        - Determine entry type from amount sign OR transaction_type field
        - Normalize amounts to positive values
        - Truncate timestamps to date strings
        """
        # Extract amount and determine direction
        amount = raw_tx.get("amount", 0)
        
        # TrueLayer: positive = credit, negative = debit
        # OR use transaction_type field (normalize to uppercase for comparison)
        tx_type = raw_tx.get("transaction_type", "")
        tx_type_upper = tx_type.upper() if isinstance(tx_type, str) else ""
        
        # Normalize amount to positive
        normalized_amount = abs(amount)
        
        # Truncate timestamp to date
        timestamp = raw_tx.get("timestamp", "")
        if "T" in timestamp:
            date_str = timestamp.split("T")[0]
        else:
            date_str = timestamp[:10] if len(timestamp) >= 10 else timestamp
        
        return TrueLayerIngestModel(
            transaction_id=raw_tx.get("transaction_id", str(hash(raw_tx.get("description", "")))),
            description=raw_tx.get("description", ""),
            amount=normalized_amount,
            currency=raw_tx.get("currency", "GBP"),
            transaction_type=tx_type_upper,  # Store normalized uppercase type
            transaction_category=raw_tx.get("transaction_category"),
            transaction_classification=raw_tx.get("transaction_classification", []),
            timestamp=date_str
        )
    
    def _hash_user_id(self, user_id: str) -> str:
        """Create a hashed account holder ID for Ntropy recurrence detection"""
        return hashlib.sha256(user_id.encode()).hexdigest()[:32]
    
    def _determine_entry_type(self, norm_tx: TrueLayerIngestModel) -> str:
        """
        Determine if a transaction is incoming (income) or outgoing (expense).
        
        TrueLayer transaction_type values (after uppercase normalization):
        - CREDIT: Money received
        - DEBIT: Money spent  
        - STANDING_ORDER: Recurring outgoing payment
        - DIRECT_DEBIT: Recurring outgoing payment
        - FEE: Outgoing fee
        """
        outgoing_types = {"DEBIT", "STANDING_ORDER", "DIRECT_DEBIT", "FEE"}
        incoming_types = {"CREDIT"}
        
        # Check transaction_type first (more reliable)
        if norm_tx.transaction_type in outgoing_types:
            return "outgoing"
        if norm_tx.transaction_type in incoming_types:
            return "incoming"
        
        # Fallback to amount sign if transaction_type is unknown
        # In TrueLayer raw data, negative = outgoing, positive = incoming
        # But we normalize to absolute values, so check the original amount in raw_tx
        # Since we don't have access to raw_tx here, assume unknown types with any amount are outgoing
        # unless explicitly marked as credit
        return "outgoing"
    
    def classify_transaction(
        self,
        labels: List[str],
        is_recurring: bool,
        entry_type: str
    ) -> str:
        """
        Phase 3: The "Triage Nurse" - classify into budget buckets
        
        Bucket A: "debt" - Loan/BNPL/credit payments
        Bucket B: "fixed" - Recurring bills and subscriptions  
        Bucket C: "discretionary" - Variable spending
        """
        labels_lower = [l.lower() for l in labels]
        labels_text = " ".join(labels_lower)
        
        # Bucket A: Check for debt indicators
        for debt_keyword in DEBT_LABELS:
            if debt_keyword in labels_text:
                return "debt"
        
        # Bucket B: Check for fixed costs OR recurring non-debt
        for fixed_keyword in FIXED_COST_LABELS:
            if fixed_keyword in labels_text:
                return "fixed"
        
        # If it's recurring but not matched above, assume fixed cost
        if is_recurring and entry_type == "outgoing":
            return "fixed"
        
        # Bucket C: Everything else that's outgoing is discretionary
        if entry_type == "outgoing":
            return "discretionary"
        
        # Income
        return "income"
    
    async def enrich_transactions(
        self,
        raw_transactions: List[Dict[str, Any]],
        user_id: str
    ) -> List[NtropyOutputModel]:
        """
        Main enrichment pipeline: ingest → normalize → enrich → classify
        
        Args:
            raw_transactions: List of raw TrueLayer transaction dicts
            user_id: User ID for recurrence detection
            
        Returns:
            List of enriched and classified transactions
        """
        results: List[NtropyOutputModel] = []
        
        # Phase 1: Normalize all transactions
        normalized = [
            self.normalize_truelayer_transaction(tx)
            for tx in raw_transactions
        ]
        
        # Phase 2: Enrich with Ntropy (if available)
        if self.sdk and NTROPY_AVAILABLE and NtropyTransactionInput:
            try:
                # Prepare batch for Ntropy using TransactionInput class
                ntropy_inputs = []
                for norm_tx in normalized:
                    entry_type = self._determine_entry_type(norm_tx)
                    ntropy_inputs.append(NtropyTransactionInput(
                        id=norm_tx.transaction_id,
                        description=norm_tx.description,
                        amount=norm_tx.amount,
                        entry_type=entry_type,
                        currency=norm_tx.currency,
                        date=norm_tx.timestamp,
                        account_holder_id=self._hash_user_id(user_id),
                        account_holder_type="consumer",
                        location={"country": "GB"}  # UK transactions
                    ))
                
                # Call Ntropy SDK for batch enrichment using the transactions.create method
                print(f"[EnrichmentService] Enriching {len(ntropy_inputs)} transactions with Ntropy...")
                
                # Process each transaction individually (or use batch if available)
                enriched_batch = []
                for tx_input in ntropy_inputs:
                    try:
                        enriched_tx = self.sdk.transactions.create(
                            id=tx_input.id,
                            description=tx_input.description,
                            amount=tx_input.amount,
                            entry_type=tx_input.entry_type,
                            currency=tx_input.currency,
                            date=tx_input.date,
                            account_holder_id=tx_input.account_holder_id,
                        )
                        enriched_batch.append(enriched_tx)
                    except Exception as tx_err:
                        print(f"[EnrichmentService] Error enriching transaction {tx_input.id}: {tx_err}")
                        enriched_batch.append(None)
                
                # Process enriched results
                for i, enriched in enumerate(enriched_batch):
                    norm_tx = normalized[i]
                    
                    # Skip if enrichment failed for this transaction
                    if enriched is None:
                        results.append(self._create_fallback_output(norm_tx))
                        continue
                    
                    # Extract Ntropy fields safely
                    enriched_dict = enriched.model_dump() if hasattr(enriched, 'model_dump') else {}
                    
                    labels = enriched_dict.get('labels', []) or []
                    merchant = enriched_dict.get('merchant', {}) or {}
                    recurrence = enriched_dict.get('recurrence', {}) or {}
                    
                    merchant_name = merchant.get('name')
                    logo_url = merchant.get('logo')
                    website_url = merchant.get('website')
                    
                    is_recurring = recurrence.get('is_recurring', False)
                    recurrence_freq = recurrence.get('frequency')
                    recurrence_day = recurrence.get('day_of_month')
                    
                    entry_type = self._determine_entry_type(norm_tx)
                    
                    # Phase 3: Classify
                    budget_category = self.classify_transaction(
                        labels=labels,
                        is_recurring=is_recurring,
                        entry_type=entry_type
                    )
                    
                    results.append(NtropyOutputModel(
                        transaction_id=norm_tx.transaction_id,
                        original_description=norm_tx.description,
                        merchant_clean_name=merchant_name,
                        merchant_logo_url=logo_url,
                        merchant_website_url=website_url,
                        labels=labels,
                        is_recurring=is_recurring,
                        recurrence_frequency=recurrence_freq,
                        recurrence_day=recurrence_day,
                        amount_cents=int(norm_tx.amount * 100),
                        entry_type=entry_type,
                        budget_category=budget_category,
                        transaction_date=norm_tx.timestamp
                    ))
                
                print(f"[EnrichmentService] Successfully enriched {len(results)} transactions")
                
            except Exception as e:
                print(f"[EnrichmentService] Ntropy enrichment failed: {e}")
                print("[EnrichmentService] Falling back to basic classification")
                results = self._fallback_classification(normalized)
        else:
            # Fallback mode - use TrueLayer classifications and basic rules
            print("[EnrichmentService] Using fallback classification (no Ntropy)")
            results = self._fallback_classification(normalized)
        
        return results
    
    def _create_fallback_output(self, norm_tx: TrueLayerIngestModel) -> NtropyOutputModel:
        """Create a fallback output for a single transaction when Ntropy enrichment fails"""
        labels = norm_tx.transaction_classification or []
        desc_lower = norm_tx.description.lower()
        is_recurring = any(kw in desc_lower for kw in [
            'dd ', 'direct debit', 'standing order', 's/o',
            'subscription', 'monthly', 'recurring'
        ])
        entry_type = self._determine_entry_type(norm_tx)
        budget_category = self._classify_by_keywords(desc_lower, labels, is_recurring, entry_type)
        
        return NtropyOutputModel(
            transaction_id=norm_tx.transaction_id,
            original_description=norm_tx.description,
            merchant_clean_name=None,
            merchant_logo_url=None,
            merchant_website_url=None,
            labels=labels,
            is_recurring=is_recurring,
            recurrence_frequency="monthly" if is_recurring else None,
            recurrence_day=None,
            amount_cents=int(norm_tx.amount * 100),
            entry_type=entry_type,
            budget_category=budget_category,
            transaction_date=norm_tx.timestamp
        )
    
    def _fallback_classification(
        self,
        normalized_transactions: List[TrueLayerIngestModel]
    ) -> List[NtropyOutputModel]:
        """
        Fallback when Ntropy is unavailable - use TrueLayer classifications
        and keyword matching for basic categorization
        """
        results = []
        
        for norm_tx in normalized_transactions:
            # Use TrueLayer classification as labels
            labels = norm_tx.transaction_classification or []
            
            # Basic keyword matching on description
            desc_lower = norm_tx.description.lower()
            
            # Detect recurring based on common patterns
            is_recurring = any(kw in desc_lower for kw in [
                'dd ', 'direct debit', 'standing order', 's/o',
                'subscription', 'monthly', 'recurring'
            ])
            
            entry_type = self._determine_entry_type(norm_tx)
            
            # Enhanced classification using description keywords
            budget_category = self._classify_by_keywords(desc_lower, labels, is_recurring, entry_type)
            
            results.append(NtropyOutputModel(
                transaction_id=norm_tx.transaction_id,
                original_description=norm_tx.description,
                merchant_clean_name=None,  # No merchant info without Ntropy
                merchant_logo_url=None,
                merchant_website_url=None,
                labels=labels,
                is_recurring=is_recurring,
                recurrence_frequency="monthly" if is_recurring else None,
                recurrence_day=None,
                amount_cents=int(norm_tx.amount * 100),
                entry_type=entry_type,
                budget_category=budget_category,
                transaction_date=norm_tx.timestamp
            ))
        
        return results
    
    def _classify_by_keywords(
        self,
        description: str,
        labels: List[str],
        is_recurring: bool,
        entry_type: str
    ) -> str:
        """Classify using keyword matching on description"""
        combined_text = description + " " + " ".join([l.lower() for l in labels])
        
        # Check for debt
        for kw in DEBT_LABELS:
            if kw in combined_text:
                return "debt"
        
        # Check for fixed costs
        for kw in FIXED_COST_LABELS:
            if kw in combined_text:
                return "fixed"
        
        # Recurring outgoing = fixed
        if is_recurring and entry_type == "outgoing":
            return "fixed"
        
        # Everything else outgoing = discretionary
        if entry_type == "outgoing":
            return "discretionary"
        
        return "income"


# ============== Batch Processing Helper ==============

async def enrich_and_analyze_budget(
    raw_transactions: List[Dict[str, Any]],
    user_id: str,
    analysis_months: int = 3
) -> Dict[str, Any]:
    """
    High-level function to enrich transactions and compute budget breakdown
    
    Returns:
        Dict containing:
        - enriched_transactions: List of enriched transaction data
        - budget_analysis: Computed budget figures
        - detected_debts: List of potential debt payments for user confirmation
    """
    service = EnrichmentService()
    
    # Enrich all transactions
    enriched = await service.enrich_transactions(raw_transactions, user_id)
    
    # Compute budget breakdown
    total_income_cents = 0
    total_fixed_cents = 0
    total_discretionary_cents = 0
    detected_debts = []
    
    for tx in enriched:
        if tx.entry_type == "incoming":
            total_income_cents += tx.amount_cents
        elif tx.budget_category == "debt":
            detected_debts.append({
                "description": tx.original_description,
                "merchant_name": tx.merchant_clean_name or tx.original_description,
                "logo_url": tx.merchant_logo_url,
                "amount_cents": tx.amount_cents,
                "is_recurring": tx.is_recurring,
                "recurrence_frequency": tx.recurrence_frequency,
                "transaction_id": tx.transaction_id
            })
        elif tx.budget_category == "fixed":
            total_fixed_cents += tx.amount_cents
        elif tx.budget_category == "discretionary":
            total_discretionary_cents += tx.amount_cents
    
    # Calculate monthly averages
    avg_income = total_income_cents // analysis_months
    avg_fixed = total_fixed_cents // analysis_months
    avg_discretionary = total_discretionary_cents // analysis_months
    
    return {
        "enriched_transactions": [tx.model_dump() for tx in enriched],
        "budget_analysis": {
            "averageMonthlyIncomeCents": avg_income,
            "fixedCostsCents": avg_fixed,
            "discretionaryCents": avg_discretionary,
            "safeToSpendCents": avg_income - avg_fixed,
            "transactionCount": len(enriched)
        },
        "detected_debts": detected_debts
    }
