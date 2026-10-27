export type OrderStatus = 'PROCESSING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
export interface Customer { id: number; name: string; email: string; }
export interface Order { id: number; customerId: number; status: OrderStatus; totalCents: number; }
export interface InventoryItem { sku: string; productName: string; stockQuantity: number; }
export interface CommerceRepository {
  getOrder(id: number): Promise<Order | null>;
  listOrders(): Promise<Order[]>;
  getCustomer(id: number): Promise<Customer | null>;
  listInventory(): Promise<InventoryItem[]>;
}
