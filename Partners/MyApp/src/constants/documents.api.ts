import { api } from "./api";

// PUT /partner/documents/kyc
export const submitKyc = (data: {
  aadhaarNumber: string;
  panNumber: string;
}) => api.put("/partner/documents/kyc", data);

// PUT /partner/documents/bank
export const submitBankDetails = (data: {
  accountHolderName: string;
  accountNumber: string;
  ifscCode: string;
  bankName: string;
}) => api.put("/partner/documents/bank", data);

// GET /partner/documents
export const getDocuments = () => api.get("/partner/documents");
