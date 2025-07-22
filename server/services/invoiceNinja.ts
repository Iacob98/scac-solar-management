import axios from 'axios';

export interface InvoiceNinjaProduct {
  id: string;
  product_key: string;
  notes: string;
  cost: number;
  price: number;
  quantity: number;
  tax_name1: string;
  tax_rate1: number;
  tax_name2: string;
  tax_rate2: number;
  tax_name3: string;
  tax_rate3: number;
  created_at: number;
  updated_at: number;
  archived_at: number;
  custom_value1: string;
  custom_value2: string;
  custom_value3: string;
  custom_value4: string;
  is_deleted: boolean;
}

export interface InvoiceNinjaClient {
  id: string;
  name: string;
  website: string;
  private_notes: string;
  balance: number;
  group_settings_id: string;
  paid_to_date: number;
  credit_balance: number;
  last_login: number;
  created_at: number;
  updated_at: number;
  archived_at: number;
  is_deleted: boolean;
  country_id: string;
  currency_id: string;
  language_id: string;
  payment_terms: number;
  address1: string;
  address2: string;
  city: string;
  state: string;
  postal_code: string;
  phone: string;
  email: string;
  cc_email: string;
  custom_value1: string;
  custom_value2: string;
  custom_value3: string;
  custom_value4: string;
  vat_number: string;
  id_number: string;
  routing_id: string;
  public_notes: string;
  client_hash: string;
  contacts: Array<{
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    send_email: boolean;
    created_at: number;
    updated_at: number;
    archived_at: number;
    is_deleted: boolean;
    is_primary: boolean;
    is_locked: boolean;
    password: string;
    last_login: number;
    contact_key: string;
    link: string;
    custom_value1: string;
    custom_value2: string;
    custom_value3: string;
    custom_value4: string;
  }>;
}

export interface InvoiceNinjaInvoice {
  id: string;
  number: string;
  balance: number;
  paid_to_date: number;
  status_id: string;
  created_at: number;
  updated_at: number;
  archived_at: number;
  is_deleted: boolean;
  user_id: string;
  assigned_user_id: string;
  client_id: string;
  project_id: string;
  expense_id: string;
  recurring_id: string;
  frequency_id: string;
  remaining_cycles: number;
  po_number: string;
  date: string;
  due_date: string;
  public_notes: string;
  private_notes: string;
  terms: string;
  footer: string;
  custom_value1: string;
  custom_value2: string;
  custom_value3: string;
  custom_value4: string;
  tax_name1: string;
  tax_rate1: number;
  tax_name2: string;
  tax_rate2: number;
  tax_name3: string;
  tax_rate3: number;
  total_taxes: number;
  is_amount_discount: boolean;
  partial: number;
  partial_due_date: string;
  discount: number;
  line_items: Array<{
    quantity: number;
    cost: number;
    product_key: string;
    notes: string;
    discount: number;
    is_amount_discount: boolean;
    tax_name1: string;
    tax_rate1: number;
    tax_name2: string;
    tax_rate2: number;
    tax_name3: string;
    tax_rate3: number;
    sort_id: number;
    line_total: number;
    gross_line_total: number;
    tax_amount: number;
    date: string;
    custom_value1: string;
    custom_value2: string;
    custom_value3: string;
    custom_value4: string;
    type_id: string;
    product_cost: number;
  }>;
  amount: number;
  uses_inclusive_taxes: boolean;
  auto_bill: string;
  auto_bill_enabled: boolean;
  viewed: boolean;
  client: InvoiceNinjaClient;
}

export interface CreateInvoiceRequest {
  client_id: string;
  line_items: Array<{
    quantity: number;
    cost: number;
    product_key: string;
    notes: string;
    custom_value1?: string;
    custom_value2?: string;
  }>;
  custom_value1?: string;
  custom_value2?: string;
  custom_value3?: string;
  custom_value4?: string;
  date: string;
  due_date: string;
  public_notes?: string;
  private_notes?: string;
}

export class InvoiceNinjaService {
  private baseUrl: string;
  private token: string;

  constructor(token: string, baseUrl: string) {
    // Remove trailing slash and ensure clean base URL
    this.baseUrl = baseUrl.replace(/\/$/, '').replace(/\/api\/v1$/, ''); 
    this.token = token;
    console.log(`InvoiceNinjaService initialized with URL: ${this.baseUrl}, token: ${token ? token.substring(0,10) + '...' : 'missing'}`);
  }

  private getHeaders() {
    return {
      'X-API-TOKEN': this.token,
      'X-Requested-With': 'XMLHttpRequest',
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
  }

  async getCompanyInfo(): Promise<{
    name: string;
    address: string;
    taxId: string;
    logoUrl?: string;
  }> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/companies`,
        { headers: this.getHeaders() }
      );

      const company = response.data.data[0]?.settings || {};

      return {
        name: company.name || company.company_name || '',
        address: this.formatAddress(company),
        taxId: company.vat_number || company.id_number || '',
        logoUrl: company.company_logo ? `${this.baseUrl}${company.company_logo}` : undefined,
      };
    } catch (error: any) {
      console.error('Error fetching company info from Invoice Ninja:', error.response?.data || error.message);
      throw new Error(`Failed to fetch company info: ${error.response?.data?.message || error.message}`);
    }
  }

  private formatAddress(company: any): string {
    const parts = [
      company.address1,
      company.address2,
      company.city,
      company.state,
      company.postal_code,
      company.country?.name || company.country,
    ].filter(Boolean);
    
    return parts.join(', ');
  }

  async getProducts(): Promise<InvoiceNinjaProduct[]> {
    try {
      const url = `${this.baseUrl}/api/v1/products`;
      console.log('Making request to:', url);
      console.log('Headers:', this.getHeaders());
      
      const response = await axios.get(url, { headers: this.getHeaders() });
      
      console.log('Response status:', response.status);
      console.log('Response data structure:', {
        hasData: !!response.data.data,
        dataLength: response.data.data?.length || 0,
        hasMeta: !!response.data.meta
      });
      
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching products from Invoice Ninja:', error.response?.data || error.message);
      throw new Error(`Failed to fetch products: ${error.response?.data?.message || error.message}`);
    }
  }

  async getClients(): Promise<InvoiceNinjaClient[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/clients`,
        { headers: this.getHeaders() }
      );
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching clients from Invoice Ninja:', error.response?.data || error.message);
      throw new Error(`Failed to fetch clients: ${error.response?.data?.message || error.message}`);
    }
  }

  async createClient(clientData: {
    name: string;
    email: string;
    phone?: string;
    address1?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    country_id?: string;
    vat_number?: string;
  }): Promise<InvoiceNinjaClient> {
    try {
      // Трансформируем данные для API Invoice Ninja v1
      const transformedData = {
        name: clientData.name,
        contact: {
          email: clientData.email,
          phone: clientData.phone || '',
        },
        address1: clientData.address1 || '',
        city: clientData.city || '',
        state: clientData.state || '',
        postal_code: clientData.postal_code || '',
        country_id: clientData.country_id || '276', // Default to Germany
        vat_number: clientData.vat_number || '',
      };

      console.log('Creating client with data:', transformedData);
      
      const response = await axios.post(
        `${this.baseUrl}/api/v1/clients`,
        transformedData,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error creating client in Invoice Ninja:', error.response?.data || error.message);
      throw new Error(`Failed to create client: ${error.response?.data?.message || error.message}`);
    }
  }

  async createInvoice(invoiceData: CreateInvoiceRequest): Promise<InvoiceNinjaInvoice> {
    try {
      console.log('Creating invoice with data:', invoiceData);
      
      const response = await axios.post(
        `${this.baseUrl}/api/v1/invoices`,
        invoiceData,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error creating invoice in Invoice Ninja:', error.response?.data || error.message);
      throw new Error(`Failed to create invoice: ${error.response?.data?.message || error.message}`);
    }
  }

  async getInvoice(invoiceId: string): Promise<InvoiceNinjaInvoice> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/invoices/${invoiceId}`,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching invoice from Invoice Ninja:', error.response?.data || error.message);
      throw new Error(`Failed to fetch invoice: ${error.response?.data?.message || error.message}`);
    }
  }



  async markInvoiceAsPaid(invoiceId: string): Promise<InvoiceNinjaInvoice> {
    try {
      // Try v5 bulk action method first
      const bulkResponse = await axios.post(
        `${this.baseUrl}/api/v1/invoices/bulk`,
        {
          action: 'mark_paid',
          ids: [invoiceId]
        },
        { headers: this.getHeaders() }
      );
      
      if (bulkResponse.data && bulkResponse.data.data && bulkResponse.data.data.length > 0) {
        return bulkResponse.data.data[0];
      }
      
      throw new Error('Bulk action did not return data');
    } catch (bulkError: any) {
      console.log('Bulk action failed, trying direct action method:', bulkError.response?.data || bulkError.message);
      
      // Fallback to direct action method
      try {
        const directResponse = await axios.put(
          `${this.baseUrl}/api/v1/invoices/${invoiceId}?action=mark_paid`,
          {},
          { headers: this.getHeaders() }
        );
        return directResponse.data.data;
      } catch (directError: any) {
        console.log('Direct action failed, trying simple update:', directError.response?.data || directError.message);
        
        // Final fallback - try updating status directly
        try {
          const updateResponse = await axios.put(
            `${this.baseUrl}/api/v1/invoices/${invoiceId}`,
            { status_id: 4 }, // Status ID 4 = Paid in Invoice Ninja
            { headers: this.getHeaders() }
          );
          return updateResponse.data.data;
        } catch (updateError: any) {
          console.error('All methods failed to mark invoice as paid in Invoice Ninja');
          throw new Error(`Failed to mark invoice as paid: ${updateError.response?.data?.message || updateError.message}`);
        }
      }
    }
  }

  async getInvoiceById(invoiceId: string): Promise<InvoiceNinjaInvoice | null> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/v1/invoices/${invoiceId}`,
        { headers: this.getHeaders() }
      );
      return response.data.data;
    } catch (error: any) {
      console.error('Error fetching invoice from Invoice Ninja:', error.response?.data || error.message);
      return null;
    }
  }

  async checkInvoicePaymentStatus(invoiceId: string): Promise<{ isPaid: boolean; statusId: string }> {
    try {
      const invoice = await this.getInvoiceById(invoiceId);
      if (!invoice) {
        throw new Error('Invoice not found in Invoice Ninja');
      }

      console.log(`Invoice ${invoiceId} status in Invoice Ninja:`, { 
        status_id: invoice.status_id, 
        balance: invoice.balance,
        amount: invoice.amount 
      });

      // Invoice Ninja v1 статусы:
      // 1 = Draft (Черновик) - НЕ оплачен
      // 2 = Sent (Отправлен) - НЕ оплачен  
      // 3 = Viewed (Просмотрен) - НЕ оплачен
      // 4 = Paid (Оплачен) - ОПЛАЧЕН
      // 5 = Partial (Частично оплачен) - НЕ оплачен
      // 6 = Cancelled (Отменен) - НЕ оплачен
      
      // ТОЛЬКО статус 4 означает оплаченный счет в Invoice Ninja
      const isPaid = invoice.status_id === '4';
      
      return {
        isPaid,
        statusId: invoice.status_id
      };
    } catch (error: any) {
      console.error('Error checking invoice payment status:', error);
      throw error;
    }
  }

  async getInvoices(): Promise<InvoiceNinjaInvoice[]> {
    try {
      const url = `${this.baseUrl}/api/v1/invoices`;
      console.log(`Fetching invoices from: ${url}`);
      console.log(`Headers:`, this.getHeaders());
      
      const response = await axios.get(url, { headers: this.getHeaders() });
      return response.data.data || [];
    } catch (error: any) {
      console.error('Error fetching invoices from Invoice Ninja:', error.response?.data || error.message);
      console.error('URL attempted:', `${this.baseUrl}/api/v1/invoices`);
      throw new Error(`Failed to fetch invoices: ${error.response?.data?.message || error.message}`);
    }
  }

  async downloadInvoicePDF(invoiceId: string): Promise<Buffer> {
    try {
      console.log(`Downloading PDF for invoice ID: ${invoiceId}`);
      
      // Сначала попробуем стандартный endpoint для скачивания PDF
      const response = await axios.get(
        `${this.baseUrl}/api/v1/invoices/${invoiceId}/download`,
        {
          headers: {
            ...this.getHeaders(),
            'Accept': 'application/pdf'
          },
          responseType: 'arraybuffer'
        }
      );
      
      return Buffer.from(response.data);
    } catch (downloadError: any) {
      console.log('Standard download failed, trying alternative method:', downloadError.response?.data || downloadError.message);
      
      try {
        // Альтернативный метод - через action
        const response = await axios.get(
          `${this.baseUrl}/api/v1/invoices/${invoiceId}?action=download`,
          {
            headers: {
              ...this.getHeaders(),
              'Accept': 'application/pdf'
            },
            responseType: 'arraybuffer'
          }
        );
        
        return Buffer.from(response.data);
      } catch (actionError: any) {
        console.log('Action download failed, trying PDF endpoint:', actionError.response?.data || actionError.message);
        
        try {
          // Третий метод - прямой PDF endpoint
          const response = await axios.get(
            `${this.baseUrl}/api/v1/invoices/${invoiceId}/pdf`,
            {
              headers: {
                ...this.getHeaders(),
                'Accept': 'application/pdf'
              },
              responseType: 'arraybuffer'
            }
          );
          
          return Buffer.from(response.data);
        } catch (pdfError: any) {
          console.error('All PDF download methods failed:', pdfError.response?.data || pdfError.message);
          throw new Error(`Failed to download invoice PDF: ${pdfError.response?.data?.message || pdfError.message}`);
        }
      }
    }
  }
}
