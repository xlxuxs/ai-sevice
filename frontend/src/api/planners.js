import { apiClient } from "./client";

export const plannerApi = {
  completeTraining() {
    return apiClient.post("/planners/training/complete");
  },
  listPendingRequests() {
    return apiClient.get("/planners/requests/pending");
  },
  approveRequest(id) {
    return apiClient.post(`/planners/requests/${id}/approve`);
  },
  rejectRequest(id, rejectionReason) {
    return apiClient.post(`/planners/requests/${id}/reject`, { rejectionReason });
  },
  search(language) {
    return apiClient.get("/planners/search", { params: { language } });
  },
  addAssociate(policyId, payload) {
    return apiClient.post(`/planners/policies/${policyId}/associates`, payload);
  },
  listAssociates(policyId) {
    return apiClient.get(`/planners/policies/${policyId}/associates`);
  },
  updateAssociate(policyId, associateId, permissions) {
    return apiClient.patch(`/planners/policies/${policyId}/associates/${associateId}`, { permissions });
  },
  revokeAssociate(policyId, associateId) {
    return apiClient.delete(`/planners/policies/${policyId}/associates/${associateId}`);
  },
};
