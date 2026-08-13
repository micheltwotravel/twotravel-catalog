const U   = (id)   => `https://images.unsplash.com/${id}?w=120&q=80&fit=crop&crop=center`;
const OFF = (path) => `https://images.openfoodfacts.org/images/products/${path}`;

export const DRINK_CATEGORIES = [
  { id:"ron",        label:"🥃 Ron",         label_en:"🥃 Rum",          items:[
    { name:"Ron Medellín 8 años",      name_en:"Rum Medellín 8 años",         emoji:"🥃", img:"https://images.rappi.com/products/7459a9d1-4ff4-4f70-9565-a72059e43a57.png",  priceCOP:110000, qty:"", note:"" },
    { name:"Ron Dictador 12",          name_en:"Rum Dictador 12",             emoji:"🥃", img:"https://dictador.com/wp-content/uploads/2024/11/Dictador_12_Blend_40vol_floating-1024x1024.png", priceCOP:295000, qty:"", note:"" },
    { name:"Aguardiente Antioqueño",   name_en:"Aguardiente Antioqueño",      emoji:"🍶", img:"https://images.rappi.com/products/1684976360608_1684976356914_1684976356232.jpg", priceCOP:55000, qty:"", note:"" },
  ]},
  { id:"tequila",    label:"🌵 Tequila",     label_en:"🌵 Tequila",       items:[
    { name:"Tequila Patrón Silver",    name_en:"Tequila Patrón Silver",       emoji:"🌵", img:"https://images.rappi.com/products/6b921167-1806-43c7-b57b-1f1579b6f72e.png",  priceCOP:258000, qty:"", note:"" },
    { name:"Tequila Don Julio Blanco", name_en:"Tequila Don Julio Blanco",    emoji:"🌵", img:"", priceCOP:320000, qty:"", note:"" },
  ]},
  { id:"vodka",      label:"🍸 Vodka",       label_en:"🍸 Vodka",         items:[
    { name:"Vodka Grey Goose",         name_en:"Vodka Grey Goose",            emoji:"🍸", img:"https://images.rappi.com/products/508701057988_skppusgjklge_103497454041_fqpzouxhrxhe_1188_1.jpeg", priceCOP:240200, qty:"", note:"" },
    { name:"Vodka Absolut",            name_en:"Vodka Absolut",               emoji:"🍸", img:"https://images.rappi.com/products/bba89040-5d68-4c76-8c7e-1c72ec394cfe.png", priceCOP:98000, qty:"", note:"" },
  ]},
  { id:"whisky",     label:"🥃 Whisky",      label_en:"🥃 Whisky",        items:[
    { name:"Whisky Johnnie Walker Black",name_en:"Whisky Johnnie Walker Black",emoji:"🥃", img:"https://images.rappi.com/products/43ee0b4d-693e-49ce-a428-3e1a5c8e9ac6.jpg",priceCOP:158000, qty:"", note:"" },
    { name:"Whisky Chivas 12",         name_en:"Whisky Chivas 12",            emoji:"🥃", img:"https://images.rappi.com/products/dd73f3c2-f6f5-4b62-93c0-9faf98e2d897.jpg", priceCOP:185000, qty:"", note:"" },
  ]},
  { id:"gin",        label:"🌿 Gin",         label_en:"🌿 Gin",           items:[
    { name:"Gin Hendricks",            name_en:"Gin Hendricks",               emoji:"🌿", img:"https://images.rappi.com/products/42203de0-ce71-4bc4-aac2-d82b2bd9ca06.png", priceCOP:276000, qty:"", note:"" },
    { name:"Tanqueray",                name_en:"Tanqueray",                   emoji:"🌿", img:"https://images.rappi.com/products/184f0c14-6df0-4938-9a4d-cf97ce3b2e1f.png", priceCOP:184000, qty:"", note:"" },
  ]},
  { id:"champagne",  label:"🥂 Champagne",   label_en:"🥂 Champagne",     items:[
    { name:"Champagne Moët & Chandon", name_en:"Champagne Moët & Chandon",    emoji:"🥂", img:"", priceCOP:485000, qty:"", note:"" },
    { name:"Espumante / Prosecco",     name_en:"Sparkling / Prosecco",        emoji:"🥂", img:"", priceCOP:85000, qty:"", note:"" },
  ]},
  { id:"beer",       label:"🍺 Beer",        label_en:"🍺 Beer",          items:[
    { name:"Águila",                   name_en:"Águila",                      emoji:"🍺", img:"https://images.rappi.com/products/e412dd24-23e9-438f-814b-a4e8925ebaf0.png", priceCOP:4500, qty:"", note:"" },
    { name:"Club Colombia",            name_en:"Club Colombia",               emoji:"🍺", img:"https://images.rappi.com/products/f2b59539-ba5b-409f-8f9b-b067b5347374.png", priceCOP:4500, qty:"", note:"" },
    { name:"Corona",                   name_en:"Corona",                      emoji:"🍺", img:"https://images.rappi.com/products/f6206ee6-78c1-4279-a9ab-b8c203f7107d.png", priceCOP:7000, qty:"", note:"" },
    { name:"Heineken",                 name_en:"Heineken",                    emoji:"🍺", img:"https://images.rappi.com/products/76028c3a-e5a8-4ff7-b3c9-a5490c39f4f0.png", priceCOP:6000, qty:"", note:"" },
    { name:"Poker",                    name_en:"Poker",                       emoji:"🍺", img:"https://images.rappi.com/products/414428019836_rxaaltnmrzon_476705357483_txldxmllacvr_50644_1.jpeg", priceCOP:4500, qty:"", note:"" },
  ]},
  { id:"wine",       label:"🍷 Wine",        label_en:"🍷 Wine",          items:[
    { name:"Red wine (bottle)",        name_en:"Red wine (bottle)",           emoji:"🍷", img:"https://images.rappi.com/products/851855029156_wvpoxqeunfmh_378174607221_vtrwvvhcgsar_1265_1.jpeg", priceCOP:0, qty:"", note:"" },
    { name:"White wine (bottle)",      name_en:"White wine (bottle)",         emoji:"🍾", img:"https://images.rappi.com/products/e1443858-0c4e-4541-894c-b7bd8eb4bd20.jpg", priceCOP:0, qty:"", note:"" },
    { name:"Rosé wine (bottle)",       name_en:"Rosé wine (bottle)",          emoji:"🌸", img:"https://images.rappi.com/products/800ac89d-5ce8-46a0-84ff-b8ff127a7af7.jpg", priceCOP:0, qty:"", note:"" },
  ]},
  { id:"mixers",     label:"🥤 Mixers",      label_en:"🥤 Mixers",        items:[
    { name:"Coca-Cola",                name_en:"Coca-Cola",                   emoji:"🥤", img:"https://images.rappi.com/products/b5d6b9d0-3fa4-465a-b7e9-48ecf4ff3bc7.png", priceCOP:3800, qty:"", note:"" },
    { name:"Tonic water",              name_en:"Tonic water",                 emoji:"🫧", img:"https://images.rappi.com/products/0b1b5e8e-c3b5-4c7f-8e5a-1b2c3d4e5f6a.png", priceCOP:3000, qty:"", note:"" },
    { name:"Ginger ale",               name_en:"Ginger ale",                  emoji:"🥤", img:"", priceCOP:4000, qty:"", note:"" },
    { name:"Orange juice",             name_en:"Orange juice",                emoji:"🍊", img:"https://images.rappi.com/products/7e8f9a0b-1c2d-3e4f-5a6b-7c8d9e0f1a2b.png", priceCOP:20000, qty:"", note:"" },
    { name:"Sparkling water",          name_en:"Sparkling water",             emoji:"💧", img:"", priceCOP:36000, qty:"", note:"" },
    { name:"Still water",              name_en:"Still water",                 emoji:"💧", img:"", priceCOP:25600, qty:"", note:"" },
    { name:"Red Bull",                 name_en:"Red Bull",                    emoji:"⚡", img:"https://images.rappi.com/products/c3d4e5f6-a7b8-c9d0-e1f2-a3b4c5d6e7f8.png", priceCOP:9400, qty:"", note:"" },
  ]},
];

export const GROCERY_CATEGORIES = [
  { id:"essentials", label:"🧂 Essentials", label_es:"🧂 Básicos", items:[
    { name:"Large Butter",   name_es:"Mantequilla grande", emoji:"🧈", img:U("photo-1589985270826-4b7bb135bc9d") },
    { name:"Oil",            name_es:"Aceite",             emoji:"🫙", img:"" },
    { name:"Salt",           name_es:"Sal",                emoji:"🧂", img:"" },
    { name:"Black pepper",   name_es:"Pimienta negra",     emoji:"🫙", img:"" },
    { name:"White Sugar",    name_es:"Azúcar blanca",      emoji:"🍬", img:"" },
    { name:"Brown Sugar",    name_es:"Azúcar morena",      emoji:"🍯", img:"" },
  ]},
  { id:"dairy", label:"🥛 Dairy", label_es:"🥛 Lácteos", items:[
    { name:"Mozzarella cheese",                          name_es:"Queso mozzarella",   emoji:"🧀", img:U("photo-1486297678162-eb2a19b0a32d") },
    { name:"Cheddar cheese",                             name_es:"Queso cheddar",      emoji:"🧀", img:"" },
    { name:"Greek Yogurt",                               name_es:"Yogurt griego",      emoji:"🥛", img:U("photo-1488477181946-6428a0291777") },
    { name:"Regular vanilla yogurt (no added fruits)",   name_es:"Yogurt vainilla",    emoji:"🥛", img:"" },
  ]},
  { id:"bread", label:"🍞 Flours & Breads", label_es:"🍞 Harinas & Panes", items:[
    { name:"Arepas",       name_es:"Arepas",            emoji:"🫓", img:"" },
    { name:"Sliced bread", name_es:"Pan tajado",         emoji:"🍞", img:U("photo-1589367920969-ab8e050bbb04") },
    { name:"Pancake mix",  name_es:"Mezcla de pancakes", emoji:"🥞", img:U("photo-1528207776546-365bb710ee93") },
  ]},
  { id:"condiments", label:"🥫 Condiments & Others", label_es:"🥫 Condimentos", items:[
    { name:"Small cereal",     name_es:"Cereal pequeño",    emoji:"🥣", img:U("photo-1517093602195-b40af9688ff7") },
    { name:"Granola box",      name_es:"Caja de granola",   emoji:"🌾", img:U("photo-1517093602195-b40af9688ff7") },
    { name:"Hot sauce",        name_es:"Salsa picante",     emoji:"🌶️", img:"" },
    { name:"Syrup",            name_es:"Sirope / Almíbar",  emoji:"🍯", img:U("photo-1558642452-9d2a7deb7f62") },
    { name:"Chocolate Chips",  name_es:"Chips de chocolate",emoji:"🍫", img:"" },
    { name:"Ketchup",          name_es:"Ketchup",           emoji:"🍅", img:"" },
    { name:"Honey",            name_es:"Miel",              emoji:"🍯", img:U("photo-1558642452-9d2a7deb7f62") },
  ]},
  { id:"grains", label:"🍚 Grains & Eggs", label_es:"🍚 Granos & Huevos", items:[
    { name:"Eggs",             name_es:"Huevos",             emoji:"🥚", img:U("photo-1582722872445-44dc5f7e3c8f") },
    { name:"Beans",            name_es:"Frijoles",           emoji:"🫘", img:"" },
    { name:"Rice",             name_es:"Arroz",              emoji:"🍚", img:U("photo-1586201375761-83865001e31c") },
    { name:"Maggi (seasoning)",name_es:"Maggi (sazón)",      emoji:"🧂", img:"" },
    { name:"Chicharrón",       name_es:"Chicharrón",         emoji:"🥓", img:"" },
  ]},
  { id:"beverages", label:"🥤 Beverages", label_es:"🥤 Bebidas", items:[
    { name:"Orange Juice",                    name_es:"Jugo de naranja",     emoji:"🍊", img:U("photo-1621506289937-a8e4df240d0b") },
    { name:"Apple Juice",                     name_es:"Jugo de manzana",     emoji:"🍎", img:U("photo-1568702846914-96b305d2aaeb") },
    { name:"Cranberry Juice",                 name_es:"Jugo de arándano",    emoji:"🫐", img:"" },
    { name:"Packs of water",                  name_es:"Paquetes de agua",    emoji:"💧", img:"" },
    { name:"Large liters of water",           name_es:"Litros de agua",      emoji:"🫧", img:"" },
    { name:"Liter Sodas (Coke Zero, Iced Coffee)", name_es:"Gaseosas litro", emoji:"🥤", img:"" },
    { name:"Lemonade",                        name_es:"Limonada",            emoji:"🍋", img:U("photo-1523677011781-ac91d64e4acb") },
    { name:"Ginger beer",                     name_es:"Cerveza de jengibre", emoji:"🍺", img:"" },
    { name:"Electrolit",                      name_es:"Electrolit",          emoji:"⚡", img:"" },
    { name:"Coconut Water",                   name_es:"Agua de coco",        emoji:"🥥", img:U("photo-1541480601022-2308c0f02487") },
    { name:"Aguardiente",                     name_es:"Aguardiente",         emoji:"🥃", img:OFF("770/204/900/0708/front_es.3.400.jpg") },
    { name:"Lime juice",                      name_es:"Jugo de limón",       emoji:"🍋", img:"" },
    { name:"Club soda",                       name_es:"Agua tónica",         emoji:"🫧", img:"" },
  ]},
  { id:"snacks", label:"🍿 Snacks", label_es:"🍿 Snacks", items:[
    { name:"Cheese empanadas", name_es:"Empanadas de queso", emoji:"🫔", img:"" },
    { name:"Potato chips",     name_es:"Papas fritas",       emoji:"🥔", img:U("photo-1566478989037-eec170784d0b") },
    { name:"Chocoramo",        name_es:"Chocoramo",          emoji:"🍫", img:OFF("770/291/459/6787/front_en.12.400.jpg") },
    { name:"Choclitos",        name_es:"Choclitos",          emoji:"🌽", img:OFF("770/218/904/5805/front_fr.4.400.jpg") },
    { name:"Platanitos",       name_es:"Platanitos",         emoji:"🍌", img:"https://www.hola-colombia.eu/web/image/product.template/494/image_1920?unique=8ab60b6" },
    { name:"Colombian Candy",  name_es:"Dulces colombianos", emoji:"🍬", img:"" },
    { name:"Peanuts",          name_es:"Maní",               emoji:"🥜", img:"" },
    { name:"Cheese board",     name_es:"Tabla de quesos",    emoji:"🧀", img:"" },
    { name:"Fresh fruit",      name_es:"Fruta fresca",       emoji:"🍓", img:"" },
    { name:"Crudités",         name_es:"Crudités",           emoji:"🥕", img:"" },
  ]},
  { id:"fruits", label:"🍍 Fruits & Vegetables", label_es:"🍍 Frutas & Verduras", items:[
    { name:"Pineapple",   name_es:"Piña",        emoji:"🍍", img:U("photo-1550258987-190a2d41a8ba") },
    { name:"Strawberries",name_es:"Fresas",       emoji:"🍓", img:U("photo-1464965911861-746a04b4bca6") },
    { name:"Bananas",     name_es:"Bananos",      emoji:"🍌", img:U("photo-1571771894821-ce9b6c11b08e") },
    { name:"Onion",       name_es:"Cebolla",      emoji:"🧅", img:U("photo-1508747703725-719777637510") },
    { name:"Tomato",      name_es:"Tomate",       emoji:"🍅", img:U("photo-1558818498-28c1e002b655") },
    { name:"Plantain",    name_es:"Plátano",      emoji:"🍌", img:"" },
    { name:"Garlic",      name_es:"Ajo",          emoji:"🧄", img:U("photo-1540148426945-6cf22a6b2383") },
    { name:"Avocado",     name_es:"Aguacate",     emoji:"🥑", img:U("photo-1523049673857-eb18f1d7b578") },
    { name:"Mango",       name_es:"Mango",        emoji:"🥭", img:U("photo-1601493700631-2b16ec4b4716") },
    { name:"Spinach",     name_es:"Espinaca",     emoji:"🥬", img:U("photo-1576045057995-568f588f82fb") },
    { name:"Lime",        name_es:"Limón",        emoji:"🍋", img:U("photo-1597714026720-8f74c62310ba") },
  ]},
  { id:"cleaning", label:"🧹 Cleaning & Misc", label_es:"🧹 Limpieza & Misc", items:[
    { name:"Napkins",                       name_es:"Servilletas",       emoji:"🧻", img:"" },
    { name:"Kitchen paper towels",          name_es:"Papel de cocina",   emoji:"🧻", img:"" },
    { name:"Dish Gloves",                   name_es:"Guantes de cocina", emoji:"🧤", img:"" },
    { name:"Dish Soap",                     name_es:"Jabón de platos",   emoji:"🫧", img:"" },
    { name:"Plastic cups (red party cups)", name_es:"Vasos plásticos",   emoji:"🥤", img:"" },
    { name:"Plastic plates",                name_es:"Platos plásticos",  emoji:"🍽️", img:"" },
  ]},
];

export function applyMenuOverrides(categories, overrides) {
  if (!overrides || !Object.keys(overrides).length) return categories;
  return categories.map(cat => ({
    ...cat,
    items: cat.items.map(it => {
      const ov = overrides[it.name];
      if (!ov) return it;
      return {
        ...it,
        ...(ov.img      !== undefined ? { img:      ov.img      } : {}),
        ...(ov.priceCOP !== undefined ? { priceCOP: ov.priceCOP } : {}),
      };
    }),
  }));
}
