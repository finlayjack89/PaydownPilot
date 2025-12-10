/*
<important_code_snippet_instructions>
Using Replit AI Integrations for Anthropic access.
For fast responses, use claude-haiku-4-5 model.
For complex reasoning, use claude-sonnet-4-5 model.
Supported models: claude-opus-4-5, claude-sonnet-4-5, claude-haiku-4-5, claude-opus-4-1
</important_code_snippet_instructions>
*/

// <important_do_not_delete>
const DEFAULT_MODEL_STR = "claude-sonnet-4-5";
const FAST_MODEL_STR = "claude-haiku-4-5";
// </important_do_not_delete>

import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_ANTHROPIC_BASE_URL,
});

interface MinPaymentRule {
  fixedCents: number;
  percentageBps: number;
  includesInterest: boolean;
}

interface AprInfo {
  purchaseAprBps: number;
  balanceTransferAprBps?: number;
  cashAdvanceAprBps?: number;
}

interface LenderRuleDiscoveryResult {
  lenderName: string;
  ruleDescription: string;
  minPaymentRule: MinPaymentRule;
  aprInfo?: AprInfo;
  confidence: "high" | "medium" | "low";
}

export async function discoverLenderRule(
  lenderName: string,
  country: string
): Promise<LenderRuleDiscoveryResult> {
  const prompt = `You are a financial data researcher. Find the minimum payment calculation rule AND typical APR rates for "${lenderName}" in ${country}.

Minimum payment rules typically follow this format:
- Fixed amount (e.g., $25, £5)
- Percentage of balance (e.g., 2.5%, 3%)
- Some rules include interest in the percentage calculation (common in UK)
- Final minimum payment is usually: max(fixed amount, percentage of balance)

Also research the typical APR (Annual Percentage Rate) for this lender's credit card for:
- Regular purchases (required)
- Balance transfers (if different, optional)
- Cash advances (if different, optional)

Research the specific rule for this lender and return ONLY a JSON object (no other text) in this exact format:
{
  "lenderName": "${lenderName}",
  "ruleDescription": "Clear description of the rule (e.g., 'Greater of 2.5% of balance or $25')",
  "minPaymentRule": {
    "fixedCents": <amount in cents, e.g., 2500 for $25>,
    "percentageBps": <percentage in basis points, e.g., 250 for 2.5%>,
    "includesInterest": <true if percentage includes interest, typically false>
  },
  "aprInfo": {
    "purchaseAprBps": <APR in basis points, e.g., 2490 for 24.9%>,
    "balanceTransferAprBps": <optional APR in basis points>,
    "cashAdvanceAprBps": <optional APR in basis points>
  },
  "confidence": "<high|medium|low>"
}

If you cannot find the exact rule, use typical industry standards for that country:
- US credit cards: max($25, 1% of balance), typical APR 20-25%
- UK credit cards: max(£5, 2.5% of balance + interest), typical APR 20-30%
- Canada: max(CA$10, 3% of balance), typical APR 19-21%
- Australia: max(AU$25, 2% of balance), typical APR 18-22%

Return ONLY the JSON object.`;

  const message = await anthropic.messages.create({
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
    model: DEFAULT_MODEL_STR,
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
  
  try {
    const result = JSON.parse(responseText);
    return result;
  } catch (error) {
    // Fallback to default rules if parsing fails
    const defaultRules: Record<string, MinPaymentRule> = {
      'US': { fixedCents: 2500, percentageBps: 100, includesInterest: false },
      'GB': { fixedCents: 500, percentageBps: 250, includesInterest: true },
      'CA': { fixedCents: 1000, percentageBps: 300, includesInterest: false },
      'AU': { fixedCents: 2500, percentageBps: 200, includesInterest: false },
    };

    const rule = defaultRules[country] || defaultRules['US'];
    return {
      lenderName,
      ruleDescription: `Default rule for ${country}: Greater of fixed amount or percentage of balance`,
      minPaymentRule: rule,
      confidence: "low",
    };
  }
}

export async function generatePlanExplanation(
  strategy: string,
  totalDebt: number,
  totalInterest: number,
  payoffMonths: number,
  accountCount: number
): Promise<string> {
  const prompt = `Generate a clear, concise explanation (2-3 paragraphs) for why this debt repayment plan works well.

Plan Details:
- Strategy: ${strategy}
- Total Debt: $${(totalDebt / 100).toFixed(2)}
- Total Interest: $${(totalInterest / 100).toFixed(2)}
- Payoff Time: ${payoffMonths} months
- Number of Accounts: ${accountCount}

The explanation should:
1. Explain how the chosen strategy benefits the user
2. Highlight the key advantages of this specific plan
3. Be encouraging and motivating without being overly optimistic
4. Use plain language for non-financial experts

Write the explanation as if speaking directly to the user ("you will", "your plan").`;

  const message = await anthropic.messages.create({
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
    model: DEFAULT_MODEL_STR,
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export async function answerPlanQuestion(
  question: string,
  planData: any,
  initialExplanation: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const systemPrompt = `You are an expert financial assistant. You are explaining a debt repayment plan generated by a separate, mathematical optimizer. You must not perform any calculations. Your only job is to explain the optimizer's logic using the data provided. Be clear, encouraging, and stick to the facts given.

The plan data includes month-by-month payment schedules showing:
- Which account receives payments each month
- Payment amounts, interest charged, and ending balances
- The total payoff timeline

Answer the user's question based solely on this data. Do not make up numbers or perform new calculations.

Initial Plan Explanation:
${initialExplanation || 'No initial explanation provided.'}

Plan Data Summary:
${Array.isArray(planData) ? 
  `The plan has ${planData.length} payment records across multiple months and accounts. Sample data: ${JSON.stringify(planData.slice(0, 10))}` :
  'No detailed plan data available.'}`;

  const messages: Array<{role: 'user' | 'assistant', content: string}> = [
    ...conversationHistory,
    { role: 'user', content: question }
  ];

  const message = await anthropic.messages.create({
    max_tokens: 1000,
    system: systemPrompt,
    messages,
    model: FAST_MODEL_STR,
  });

  return message.content[0].type === 'text' ? message.content[0].text : '';
}

export interface StatementGuidanceResult {
  bankName: string;
  guidance: string;
  sources: {
    type: 'official' | 'community' | 'general';
    description: string;
  }[];
  confidence: 'high' | 'medium' | 'low';
}

export async function getStatementBucketGuidance(
  bankName: string,
  country: string = 'UK',
  conversationHistory: ChatMessage[] = []
): Promise<StatementGuidanceResult> {
  const systemPrompt = `You are a helpful financial assistant who helps users find the breakdown of their credit card balance (into different "buckets" like purchases, balance transfers, cash advances) from their bank statements.

Your job is to provide step-by-step guidance on WHERE to find this information on their credit card statement for "${bankName}" in the ${country}.

UK credit card statements typically break down balances in an "Interest Summary Table" or similar section. Different banks format this differently:

For your guidance, include:
1. SPECIFIC section names to look for on the statement (e.g., "Interest Charge Calculation", "Interest Summary", "Balance Summary")
2. What page it's typically found on (e.g., "usually on page 2 or 3")
3. What the breakdown typically shows (purchases at X%, balance transfers at Y%, etc.)
4. How to identify promotional 0% rates vs standard rates
5. Where to find the promotional expiry dates

IMPORTANT CONTEXT FROM UK FINANCIAL GUIDANCE:
- Since 2011, UK credit cards must prioritize payments to highest-rate debt first
- Statements show separate interest rates for: Purchases, Balance Transfers, Cash Advances, Money Transfers
- Money Saving Expert (MSE) is a highly authoritative UK source for credit card guidance
- Common UK lenders: Barclays, HSBC, Lloyds, NatWest, Nationwide, Santander, Tesco Bank, Virgin Money, American Express, MBNA

If you don't have specific information about this bank, provide general guidance about UK credit card statements and suggest the user:
1. Download the full PDF statement (not just the transaction list from online banking)
2. Look for an "Interest Charge Calculation" or "Interest Summary" section
3. Contact the bank's customer service if they can't find it

Be helpful, specific, and encouraging. Keep your response focused and practical.`;

  const userPrompt = `Help me find where to look on my ${bankName} credit card statement to find the breakdown of my balance into purchases, balance transfers, cash advances, etc. with their different interest rates.`;

  const validMessages = conversationHistory.filter(m => m.content && m.content.trim().length > 0);
  
  const messages: Array<{role: 'user' | 'assistant', content: string}> = validMessages.length > 0
    ? validMessages
    : [{ role: 'user', content: userPrompt }];

  if (messages.length === 0 || !messages[0].content) {
    messages.unshift({ role: 'user', content: userPrompt });
  }
  
  if (messages[0].role !== 'user') {
    messages.unshift({ role: 'user', content: userPrompt });
  }

  console.log('[Statement Guidance] Final messages structure:', messages.map(m => ({ role: m.role, contentLength: m.content?.length || 0 })));

  const message = await anthropic.messages.create({
    max_tokens: 1500,
    system: systemPrompt,
    messages,
    model: DEFAULT_MODEL_STR,
  });

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  const sources: StatementGuidanceResult['sources'] = [];
  
  if (responseText.toLowerCase().includes('money saving expert') || responseText.toLowerCase().includes('mse')) {
    sources.push({ type: 'community', description: 'Money Saving Expert guidance' });
  }
  if (responseText.toLowerCase().includes('official') || responseText.toLowerCase().includes('bank website')) {
    sources.push({ type: 'official', description: `${bankName} official documentation` });
  }
  if (sources.length === 0) {
    sources.push({ type: 'general', description: 'UK credit card statement standards' });
  }

  const knownUkBanks = ['barclays', 'hsbc', 'lloyds', 'natwest', 'nationwide', 'santander', 'tesco', 'virgin', 'amex', 'american express', 'mbna', 'halifax', 'rbs', 'tsb', 'monzo', 'starling'];
  const isKnownBank = knownUkBanks.some(bank => bankName.toLowerCase().includes(bank));

  return {
    bankName,
    guidance: responseText,
    sources,
    confidence: isKnownBank ? 'high' : 'medium',
  };
}

export async function chatStatementGuidance(
  bankName: string,
  userMessage: string,
  conversationHistory: ChatMessage[] = []
): Promise<string> {
  const initialUserMessage = `Help me find where to look on my ${bankName} credit card statement to find the breakdown of my balance into purchases, balance transfers, cash advances, etc. with their different interest rates.`;
  
  const validHistory = conversationHistory.filter(m => m.content && m.content.trim().length > 0);
  
  let fullHistory: ChatMessage[] = [];
  
  if (validHistory.length === 0) {
    fullHistory = [{ role: 'user', content: userMessage }];
  } else {
    if (validHistory[0].role === 'assistant') {
      fullHistory = [
        { role: 'user', content: initialUserMessage },
        ...validHistory,
        { role: 'user', content: userMessage }
      ];
    } else {
      fullHistory = [...validHistory, { role: 'user', content: userMessage }];
    }
  }
  
  console.log('[Statement Guidance Chat] Messages being sent:', JSON.stringify(fullHistory.map(m => ({ role: m.role, contentLength: m.content?.length || 0 }))));
  
  const result = await getStatementBucketGuidance(bankName, 'UK', fullHistory);
  return result.guidance;
}
