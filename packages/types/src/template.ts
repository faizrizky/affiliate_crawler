export interface Template {
  id: string;
  name: string;
  content: string;
  variables: string[] | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TemplateCreateInput {
  name: string;
  content: string;
}

export interface TemplateUpdateInput {
  name?: string;
  content?: string;
}
