# Products Module Map (inventory-system)

| Source Path | Role in inventory-system | Suggested OlivoWeb Target |
| --- | --- | --- |
| vendor/inventory-system/src/app/(overview)/products/page.tsx | Server component that builds the products list view (search params, pagination, suspense-wrapped table). | app/(dashboard)/productos/page.tsx |
| vendor/inventory-system/src/app/(overview)/products/add/page.tsx | Loads categories on the server and renders the add-product form route. | app/(dashboard)/productos/agregar/page.tsx |
| vendor/inventory-system/src/app/(overview)/products/edit/page.tsx | Fetches a single product + categories, guards missing IDs, renders edit form route. | app/(dashboard)/productos/editar/page.tsx |
| vendor/inventory-system/src/components/tables/product.tsx | Async table component that lists products with actions (view, add lot, edit, delete) and consumes Supabase server query. | src/components/productos/ProductTable.tsx |
| vendor/inventory-system/src/components/forms/product/add-product.tsx | Client form wired to addProduct server action via useFormState, handles validation errors inline. | src/components/productos/forms/AddProductForm.tsx |
| vendor/inventory-system/src/components/forms/product/edit-product.tsx | Client form for editing with hidden id, prefilled fields, editProduct action binding. | src/components/productos/forms/EditProductForm.tsx |
| vendor/inventory-system/src/components/show/product.tsx | Read-only card used inside modals to show product detail snapshot. | src/components/productos/ShowProductCard.tsx |
| vendor/inventory-system/src/components/charts/general/product-chart.tsx | Server component aggregating stock per category, passes data to interactive chart. | src/components/productos/charts/ProductChart.tsx |
| vendor/inventory-system/src/components/charts/general/product-bar.tsx | Client-side bar chart with category selector built on TemplateBarChart + SelectGeneral. | src/components/productos/charts/ProductBar.tsx |
| vendor/inventory-system/src/services/product/server.ts | Supabase server utilities (CRUD, counts, RPC) plus cache revalidation entry. | src/server/products.service.ts |
| vendor/inventory-system/src/services/product/client.ts | Form actions that call server utilities, run Zod validation, trigger toast + redirects. | src/actions/products.ts |
| vendor/inventory-system/src/models/zod_schema.ts (FormProductSchema) | Zod schema for validating category/name/description fields. | src/schemas/product.schema.ts |
| vendor/inventory-system/src/models/state_forms.ts (FormProductState) | Typed form-state shape consumed by client actions for error messaging. | src/types/forms/productFormState.ts |

**Hooks note:** No bespoke product hooks exist in this repo; forms rely on React's useFormState. If OlivoWeb needs reusable logic (filters, pagination state), plan to add dedicated hooks such as src/hooks/useProductFilters.ts when adapting the module.
