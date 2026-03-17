import { projectId, publicAnonKey } from '../../../../../../../utils/supabase/info';
import { 
  FetchDocumentsResponse, 
  DocumentOperationResponse, 
  DownloadUrlResponse,
  DocumentUploadPayload,
  LinkCreationPayload,
  DocumentUpdatePayload
} from '../types';

export class DocumentApiService {
  private static BASE_URL = `https://${projectId}.supabase.co/functions/v1/make-server-91ed8379/documents`;
  private static HEADERS = {
    'Authorization': `Bearer ${publicAnonKey}`
  };

  /**
   * Fetch documents for a client
   */
  static async fetchDocuments(clientId: string): Promise<FetchDocumentsResponse> {
    const response = await fetch(`${this.BASE_URL}/${clientId}`, {
      headers: this.HEADERS
    });

    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }

    return await response.json();
  }

  /**
   * Upload a new document
   */
  static async uploadDocument(clientId: string, payload: DocumentUploadPayload): Promise<DocumentOperationResponse> {
    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('title', payload.title);
    formData.append('productCategory', payload.productCategory);
    formData.append('policyNumber', payload.policyNumber);
    formData.append('uploadedBy', payload.uploadedBy);

    const response = await fetch(`${this.BASE_URL}/${clientId}/upload`, {
      method: 'POST',
      headers: this.HEADERS,
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Upload failed');
    }

    return await response.json();
  }

  /**
   * Add a new link
   */
  static async addLink(clientId: string, payload: LinkCreationPayload): Promise<DocumentOperationResponse> {
    const response = await fetch(`${this.BASE_URL}/${clientId}/link`, {
      method: 'POST',
      headers: {
        ...this.HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create link');
    }

    return await response.json();
  }

  /**
   * Update document status or metadata
   */
  static async updateDocument(clientId: string, documentId: string, updates: DocumentUpdatePayload): Promise<DocumentOperationResponse> {
    const response = await fetch(`${this.BASE_URL}/${clientId}/${documentId}`, {
      method: 'PATCH',
      headers: {
        ...this.HEADERS,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      throw new Error('Failed to update document');
    }

    return await response.json();
  }

  /**
   * Delete a document
   */
  static async deleteDocument(clientId: string, documentId: string): Promise<DocumentOperationResponse> {
    const response = await fetch(`${this.BASE_URL}/${clientId}/${documentId}`, {
      method: 'DELETE',
      headers: this.HEADERS
    });

    if (!response.ok) {
      throw new Error('Failed to delete document');
    }

    return await response.json();
  }

  /**
   * Get download URL for a document
   */
  static async getDownloadUrl(clientId: string, documentId: string): Promise<DownloadUrlResponse> {
    const response = await fetch(`${this.BASE_URL}/${clientId}/${documentId}/download`, {
      headers: this.HEADERS
    });

    if (!response.ok) {
      throw new Error('Failed to get download URL');
    }

    return await response.json();
  }
}