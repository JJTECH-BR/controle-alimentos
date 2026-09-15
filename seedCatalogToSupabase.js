import { createClient } from '@supabase/supabase-js';
import { catalogProducts } from './src/catalog.js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url) {
  console.error('Erro: VITE_SUPABASE_URL ou SUPABASE_URL não foi definido.');
  process.exit(1);
}

if (!anonKey && !serviceRoleKey) {
  console.error('Erro: nenhuma chave do Supabase foi encontrada. Defina VITE_SUPABASE_ANON_KEY, SUPABASE_ANON_KEY ou SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey || anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const normalizeText = (value) => String(value ?? '').trim();

async function upsertTable(tableName, columnName, values) {
  const uniqueValues = [...new Set(values.map((v) => normalizeText(v)).filter(Boolean))];
  if (!uniqueValues.length) return [];

  const { data, error } = await supabase
    .from(tableName)
    .upsert(uniqueValues.map((name) => ({ [columnName]: name })), {
      onConflict: columnName,
      ignoreDuplicates: false,
    })
    .select('id, name');

  if (error) {
    throw new Error(`Erro ao sincronizar ${tableName}: ${error.message}`);
  }

  return data ?? [];
}

async function seedCatalog() {
  const categoryNames = [...new Set(catalogProducts.map((product) => product.category || 'Sem categoria'))];
  const supplierNames = [...new Set(catalogProducts.map((product) => product.supplier || 'Sem fornecedor'))];

  const categoryRows = await upsertTable('categories', 'name', categoryNames);
  const supplierRows = await upsertTable('suppliers', 'name', supplierNames);

  const categoryMap = new Map(categoryRows.map((row) => [row.name, row.id]));
  const supplierMap = new Map(supplierRows.map((row) => [row.name, row.id]));

  const productsToInsert = catalogProducts.map((product) => ({
    name: String(product.name).trim().toUpperCase(),
    category_id: categoryMap.get(product.category || 'Sem categoria'),
    supplier_id: supplierMap.get(product.supplier || 'Sem fornecedor'),
    unit: String(product.unit || 'kg').trim() || 'kg',
    stock: Number(product.stock ?? 0),
    min_stock: Number(product.minStock ?? 10),
    active: true,
    updated_at: new Date().toISOString(),
  }));

  const { data: insertedProducts, error: productsError } = await supabase
    .from('products')
    .upsert(productsToInsert, {
      onConflict: 'name',
      ignoreDuplicates: false,
    })
    .select('id, name');

  if (productsError) {
    throw new Error(`Erro ao sincronizar produtos: ${productsError.message}`);
  }

  console.log('Seed concluído com sucesso.');
  console.log(`Categorias: ${categoryRows.length}`);
  console.log(`Fornecedores: ${supplierRows.length}`);
  console.log(`Produtos: ${insertedProducts?.length ?? 0}`);
}

try {
  await seedCatalog();
} catch (error) {
  console.error('Falha ao subir o catálogo para o banco:', error.message);
  process.exit(1);
}
