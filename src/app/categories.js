  function safeDataId(value,fallback){const cleaned=String(value||'').trim().slice(0,96).replace(/[^a-zA-Z0-9_-]/g,'-').replace(/^-+|-+$/g,'');return cleaned||fallback;}
  function normalizeCategories(input) {
    const source = Array.isArray(input) && input.length ? input : DEFAULT_CATEGORIES;
    const seen = new Set();
    const result = source.map((item,index) => ({
      id: safeDataId(item?.id,'category-'+index+'-'+hashText(item?.name||index)),
      name: String(item?.name || '카테고리').trim().slice(0,24),
      icon: ICON_CANDIDATES.includes(item?.icon) ? item.icon : '📦',
      system: Boolean(item?.system)
    })).filter(item => item.name && !seen.has(item.id) && seen.add(item.id));
    for(const id of REQUIRED_CATEGORY_IDS){
      if(result.some(item=>item.id===id))continue;
      result.push(id==='misc'?{id,name:'기타',icon:'📦',system:true}:{id,name:'삭제된 카테고리',icon:'🗑️',system:true});
    }
    Object.assign(result.find(item=>item.id==='misc'),{name:'기타',icon:'📦',system:true});
    Object.assign(result.find(item=>item.id===DELETED_CATEGORY_ID),{name:'삭제된 카테고리',icon:'🗑️',system:true});
    return result;
  }
  function findCategoryId(raw,cats=categories) {
    if (cats.some(item => item.id === raw)) return raw;
    const byName = cats.find(item => item.name === raw || (item.icon+' '+item.name) === raw);
    return byName?.id || cats.find(item=>item.id==='misc')?.id || cats[0]?.id || DELETED_CATEGORY_ID;
  }
  // Ledger arithmetic uses decimal integers; only JSON boundaries use Number.
