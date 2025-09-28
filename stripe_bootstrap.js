// B2B
for (const p of catalog.b2b) {
  const product = await getOrCreateProduct({
    slug: p.slug,
    name: p.name,
    description: p.description,
    extraMeta: p.extraMeta || { segment: 'b2b' },
  });

  for (const pr of p.prices) {
    if (pr.unit_amount == null) {
      console.log(`↪ Skipping placeholder price for ${p.slug} (no unit_amount)`);
      continue; // don't create a price with no unit_amount
    }
    await ensurePrice({
      ...pr,
      productId: product.id,
      active: typeof pr.active === 'boolean' ? pr.active : true,
    });
  }
}
