# enrichment_service.py - Ntropy Transaction Enrichment Service
# Handles TrueLayer → Ntropy → Budget Classification pipeline

import os
import hashlib
from typing import List, Dict, Any, Optional
from pydantic import BaseModel, Field

# Ntropy SDK import
NTROPY_AVAILABLE = False
NtropySDK = None
NtropyTransaction = None

try:
    from ntropy_sdk import SDK, Transaction
    NtropySDK = SDK
    NtropyTransaction = Transaction
    NTROPY_AVAILABLE = True
except ImportError:
    print("[EnrichmentService] Warning: ntropy-sdk not available, running in fallback mode")


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
        - Convert negative amounts to absolute values
        - Derive entry type from amount sign or transaction_type
        - Truncate timestamps to date strings
        """
        # Extract amount and determine direction
        amount = raw_tx.get("amount", 0)
        
        # TrueLayer: positive = credit, negative = debit
        # OR use transaction_type field
        tx_type = raw_tx.get("transaction_type", "")
        
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
            transaction_type=tx_type,
            transaction_category=raw_tx.get("transaction_category"),
            transaction_classification=raw_tx.get("transaction_classification", []),
            timestamp=date_str
        )
    
    def _hash_user_id(self, user_id: str) -> str:
        """Create a hashed account holder ID for Ntropy recurrence detection"""
        return hashlib.sha256(user_id.encode()).hexdigest()[:32]
    
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
        if self.sdk and NTROPY_AVAILABLE and NtropyTransaction:
            try:
                # Prepare batch for Ntropy using Transaction class
                ntropy_inputs = []
                for norm_tx in normalized:
                    entry_type = "outgoing" if norm_tx.transaction_type == "DEBIT" or norm_tx.amount < 0 else "incoming"
                    ntropy_inputs.append(NtropyTransaction(
                        transaction_id=norm_tx.transaction_id,
                        description=norm_tx.description,
                        amount=norm_tx.amount,
                        entry_type=entry_type,
                        iso_currency_code=norm_tx.currency,
                        date=norm_tx.timestamp,
                        account_holder_id=self._hash_user_id(user_id),
                        account_holder_type="consumer",
                        country="GB"  # UK transactions
                    ))
                
                # Call Ntropy SDK for batch enrichment
                print(f"[EnrichmentService] Enriching {len(ntropy_inputs)} transactions with Ntropy...")
                enriched_batch = self.sdk.add_transactions(ntropy_inputs)
                
                # Process enriched results
                for i, enriched in enumerate(enriched_batch):
                    norm_tx = normalized[i]
                    
                    # Extract Ntropy fields safely
                    enriched_dict = enriched.to_dict() if hasattr(enriched, 'to_dict') else {}
                    
                    labels = enriched_dict.get('labels', []) or []
                    merchant = enriched_dict.get('merchant', {}) or {}
                    recurrence = enriched_dict.get('recurrence', {}) or {}
                    
                    merchant_name = merchant.get('name')
                    logo_url = merchant.get('logo')
                    website_url = merchant.get('website')
                    
                    is_recurring = recurrence.get('is_recurring', False)
                    recurrence_freq = recurrence.get('frequency')
                    recurrence_day = recurrence.get('day_of_month')
                    
                    entry_type = "incoming" if norm_tx.amount > 0 and norm_tx.transaction_type != "DEBIT" else "outgoing"
                    
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
            
            entry_type = "incoming" if norm_tx.amount > 0 and norm_tx.transaction_type != "DEBIT" else "outgoing"
            
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
