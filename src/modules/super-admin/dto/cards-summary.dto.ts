export class CardsSummaryDto {
  chambers: { active: number; inactive: number };
  orders: { completed: number; pending: number };
  products: { approved: number; pending: number };
  sellerApplications: { approved: number; pending: number };
}
