export interface Project {
  id: string | number;
  name: string;
  description?: string;
  location?: string;
  client_name?: string;
  start_date?: string;
  end_date?: string;
  company_id?: number;
  boq_documents?: any[];
  integrations?: any[];
  contracts?: any[];
}
