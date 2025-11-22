const fs = require('fs');
const path = require('path');

// Fix order-workflow.service.ts
const workflowPath = 'c:\\Users\\Kenneth\\Desktop\\PP Namias\\MASH-Backend\\src\\modules\\orders\\services\\order-workflow.service.ts';
let workflowContent = fs.readFileSync(workflowPath, 'utf8');

// Remove prometheus timer calls
workflowContent = workflowContent.replace(/const timer = this\.prometheus\.startTimer\([^)]+\);?\n?/g, '');
workflowContent = workflowContent.replace(/timer\(\);?\n?/g, '');

// Replace prometheus.incrementCounter with direct counter access
workflowContent = workflowContent.replace(/this\.prometheus\.incrementCounter\('orders_created_total', \{ source: 'cart' \}\);?/g, 
  "this.prometheus.ordersTotal.labels(OrderStatus.PENDING, 'unknown').inc();");
workflowContent = workflowContent.replace(/this\.prometheus\.incrementCounter\('orders_created_total', \{ source: 'direct' \}\);?/g, 
  "this.prometheus.ordersTotal.labels(OrderStatus.PENDING, 'unknown').inc();");
workflowContent = workflowContent.replace(/this\.prometheus\.incrementCounter\('order_creation_errors_total'[^)]*\);?/g, '');

// Add CartStatus import
if (!workflowContent.includes('CartStatus')) {
  workflowContent = workflowContent.replace(
    "import { OrderStatus, Prisma } from '@prisma/client';",
    "import { OrderStatus, CartStatus } from '@prisma/client';"
  );
}

// Fix OrderStatusHistory fields - change 'status' to 'fromStatus' and 'toStatus'
workflowContent = workflowContent.replace(
  /await prisma\.orderStatusHistory\.create\(\{\s*data: \{\s*orderId: order\.id,\s*status: OrderStatus\.PENDING,\s*previousStatus: null,/gs,
  `await prisma.orderStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: OrderStatus.PENDING,
          toStatus: OrderStatus.PENDING,`
);

// Fix cart status update - CONVERTED doesn't exist, use COMPLETED
workflowContent = workflowContent.replace(/status: 'CONVERTED'/g, "status: CartStatus.COMPLETED");

// Fix duplicate calculatePricing method - rename the public one
const regex1 = /\/\*\*\s*\n\s*\* Calculate order pricing before creation\s*\n\s*\*\/\s*\n\s*async calculatePricing\(items: any\[\]\): Promise<CalculateOrderResponseDto>/;
workflowContent = workflowContent.replace(regex1, 
  `/**
   * Calculate order pricing before creation (public API method)
   */
  async calculatePricing(items: any[]): Promise<CalculateOrderResponseDto>`);

// Rename the internal calculatePricing method to calculateCartPricing
const regex2 = /\/\*\*\s*\n\s*\* Calculate pricing from cart\s*\n\s*\*\/\s*\n\s*private calculatePricing\(cart: any\)/;
workflowContent = workflowContent.replace(regex2,
  `/**
   * Calculate pricing from cart (internal method)
   */
  private calculateCartPricing(cart: any)`);

// Update calls to the internal method
workflowContent = workflowContent.replace(/const pricing = this\.calculatePricing\(cart\);/g, 
  'const pricing = this.calculateCartPricing(cart);');

// Fix the CalculateOrderResponseDto breakdown structure
workflowContent = workflowContent.replace(
  /breakdown: \{\s*items: items\.map\(item => \(\{[^}]+\}\)\),\s*\}/gs,
  `breakdown: {
        subtotalBreakdown: {
          items: subtotal,
        },
        taxBreakdown: {
          vat: taxAmount,
        },
        discountBreakdown: {},
      }`
);

// Fix CreateOrderDto field references
workflowContent = workflowContent.replace(/dto\.shippingAddress/g, 'dto.shippingAddressId');
workflowContent = workflowContent.replace(/dto\.billingAddress/g, 'dto.billingAddressId');
workflowContent = workflowContent.replace(/paymentMethod: dto\.paymentMethod,/g, '');

fs.writeFileSync(workflowPath, workflowContent, 'utf8');
console.log('✅ Fixed order-workflow.service.ts');

// Fix order-pricing.service.ts
const pricingPath = 'c:\\Users\\Kenneth\\Desktop\\PP Namias\\MASH-Backend\\src\\modules\\orders\\services\\order-pricing.service.ts';
let pricingContent = fs.readFileSync(pricingPath, 'utf8');

// Remove prometheus timer calls
pricingContent = pricingContent.replace(/const timer = this\.prometheus\.startTimer\([^)]+\);?\n?/g, '');
pricingContent = pricingContent.replace(/timer\(\);?\n?/g, '');

// Remove prometheus.incrementCounter calls
pricingContent = pricingContent.replace(/this\.prometheus\.incrementCounter\([^)]+\);?\n?/g, '');

fs.writeFileSync(pricingPath, pricingContent, 'utf8');
console.log('✅ Fixed order-pricing.service.ts');

console.log('\n✅ All services fixed! Run npm run build to verify.');
