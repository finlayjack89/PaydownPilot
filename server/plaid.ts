import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

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

export const PLAID_PRODUCTS = [Products.Liabilities];
export const PLAID_COUNTRY_CODES = [
  CountryCode.Us,
  CountryCode.Gb,
  CountryCode.Ca,
];
