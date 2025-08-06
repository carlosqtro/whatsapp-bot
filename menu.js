// menu.js

const menu = [
    // Platos principales
    {
      id: 1,
      name: 'Milanesa con puré',
      price: 350,
      category: 'Platos Principales',
      imageUrl: 'https://imagenes.20minutos.es/files/image_1920_1080/uploads/imagenes/2023/08/14/milanesa-argentina-1.jpeg'
    },
    {
      id: 2,
      name: 'Chivito al plato',
      price: 420,
      category: 'Platos Principales',
      imageUrl: 'https://media-cdn.tripadvisor.com/media/photo-s/16/3f/66/95/chivito-al-plato-para.jpg'
    },
    {
      id: 3,
      name: 'Pizza muzzarella',
      price: 300,
      category: 'Platos Principales',
      imageUrl: 'https://acdn-us.mitiendanube.com/stores/001/664/252/products/4e475ddf-2c43-4d47-b69c-990a92e91029-26f258f7fdb6a2b9fb16276674103675-640-0.jpeg'
    },
  
    // Bebidas
    {
      id: 4,
      name: 'Coca-Cola 500ml',
      price: 120,
      category: 'Bebidas',
      imageUrl: 'https://t4.ftcdn.net/jpg/02/84/65/61/360_F_284656117_sPF8gVWaX627bq5qKrlrvCz1eFfowdBf.jpg'
    },
    {
      id: 5,
      name: 'Agua mineral',
      price: 90,
      category: 'Bebidas',
      imageUrl: 'https://thumbs.dreamstime.com/b/agua-pura-rellena-con-botella-de-pl%C3%A1stico-aislada-en-fondo-blanco-beber-mineral-l%C3%ADquido-transparente-el-frasco-fresco-y-fr%C3%ADo-385612447.jpg'
    },

    // Postres
    {
        id: 6,
        name: 'Flan con dulce de leche',
        price: 180,
        category: 'Postres',
        imageUrl: 'https://125538537.cdn6.editmysite.com/uploads/1/2/5/5/125538537/IX5VZWTP6PV2RUDGPAR5AWCA.jpeg'
    }
];

// Obtenemos una lista única de categorías para el menú principal
const categoriasUnicas = [...new Set(menu.map(item => item.category))];

/**
 * Genera el texto del menú de categorías inicial.
 * @returns {string} El menú de categorías.
 */
function getCategoriasMenu() {
    let menuText = "¡Bienvenido a SoyRestaurant! 🤖\n\nPor favor, elige una categoría para ver los productos:\n";
    categoriasUnicas.forEach((categoria, index) => {
        menuText += `\n*${index + 1}️⃣* - ${categoria}`;
    });
    menuText += "\n\n*S* - Salir";
    return menuText;
}

/**
 * Obtiene los productos que pertenecen a una categoría específica.
 * @param {string} categoria - El nombre de la categoría.
 * @returns {Array} Una lista de los productos de esa categoría.
 */
function getItemsPorCategoria(categoria) {
    return menu.filter(item => item.category === categoria);
}

module.exports = { menu, categoriasUnicas, getCategoriasMenu, getItemsPorCategoria };