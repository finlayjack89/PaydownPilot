import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode, Transaction } from 'plaid';

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as 'sandbox' | 'development' | 'production'] || PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export const PLAID_PRODUCTS = [Products.Liabilities, Products.Transactions];
export const PLAID_COUNTRY_CODES = [
  CountryCode.Us,
  CountryCode.Gb,
  CountryCode.Ca,
];

/**
 * Fetches transactions from Plaid for a given access token
 * @param accessToken - The Plaid access token
 * @param days - Number of days to fetch transactions for (default 90)
 * @returns Array of Plaid transactions
 */
export async function fetchTransactions(accessToken: string, days: number = 90): Promise<Transaction[]> {
  const now = new Date();
  const startDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
  
  try {
    const response = await plaidClient.transactionsGet({
      access_token: accessToken,
      start_date: startDate.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
      options: {
        count: 500, // Fetch up to 500 transactions
        offset: 0,
      }
    });
    
    // If there are more transactions, fetch them all
    let allTransactions = response.data.transactions;
    const totalTransactions = response.data.total_transactions;
    
    // Fetch remaining transactions if needed
    while (allTransactions.length < totalTransactions) {
      const paginatedResponse = await plaidClient.transactionsGet({
        access_token: accessToken,
        start_date: startDate.toISOString().split('T')[0],
        end_date: now.toISOString().split('T')[0],
        options: {
          count: 500,
          offset: allTransactions.length,
        }
      });
      
      allTransactions = [...allTransactions, ...paginatedResponse.data.transactions];
    }
    
    return allTransactions;
  } catch (error: any) {
    console.error('Error fetching transactions from Plaid:', error.response?.data || error);
    throw new Error(`Failed to fetch transactions: ${error.response?.data?.error_message || error.message}`);
  }
}
