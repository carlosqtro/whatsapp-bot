// menu.js

const menu = [
    // Platos principales
    {
      id: 1,
      name: 'Milanesa con puré',
      price: 350,
      category: 'Platos Principales',
      imageUrl: 'https://i.imgur.com/gHVAa9T.jpeg'
    },
    {
      id: 2,
      name: 'Chivito al plato',
      price: 420,
      category: 'Platos Principales',
      imageUrl: 'https://i.imgur.com/GnpKRfH.jpeg'
    },
    {
      id: 3,
      name: 'Pizza muzzarella',
      price: 300,
      category: 'Platos Principales',
      imageUrl: 'https://i.imgur.com/TBCn2sC.jpeg'
    },
  
    // Bebidas
    {
      id: 4,
      name: 'Coca-Cola 500ml',
      price: 120,
      category: 'Bebidas',
      imageUrl: 'https://i.imgur.com/IUNTIe6.jpeg'
    },
    {
      id: 5,
      name: 'Agua mineral',
      price: 90,
      category: 'Bebidas',
      imageUrl: 'https://i.imgur.com/uDTAW5d.jpeg'
    },

    // Postres
    {
        id: 6,
        name: 'Flan con dulce de leche',
        price: 180,
        category: 'Postres',
        imageUrl: 'https://i.imgur.com/o7pYx1z.jpeg'
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