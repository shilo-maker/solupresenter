// Predefined beautiful gradient presets
export const gradientPresets = [
  {
    name: 'Ocean Blue',
    value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    name: 'Sunset',
    value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    name: 'Forest',
    value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    name: 'Fire',
    value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  },
  {
    name: 'Purple Dream',
    value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
  },
  {
    name: 'Deep Space',
    value: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
  },
  {
    name: 'Cherry Blossom',
    value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
  },
  {
    name: 'Northern Lights',
    value: 'linear-gradient(135deg, #a8caba 0%, #5d4e6d 100%)'
  },
  {
    name: 'Tropical',
    value: 'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)'
  },
  {
    name: 'Royal Purple',
    value: 'linear-gradient(135deg, #868f96 0%, #596164 100%)'
  },
  {
    name: 'Candy',
    value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
  },
  {
    name: 'Sea Breeze',
    value: 'linear-gradient(135deg, #2af598 0%, #009efd 100%)'
  },
  {
    name: 'Autumn',
    value: 'linear-gradient(135deg, #f77062 0%, #fe5196 100%)'
  },
  {
    name: 'Midnight',
    value: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'
  },
  {
    name: 'Spring',
    value: 'linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)'
  },
  {
    name: 'Peacock',
    value: 'linear-gradient(135deg, #20E2D7 0%, #F9FEA5 100%)'
  },
  {
    name: 'Rose Gold',
    value: 'linear-gradient(135deg, #f4c4f3 0%, #fc67fa 100%)'
  },
  {
    name: 'Desert',
    value: 'linear-gradient(135deg, #ffa751 0%, #ffe259 100%)'
  },
  {
    name: 'Ice',
    value: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)'
  },
  {
    name: 'Lava',
    value: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)'
  }
];

// Generate a random gradient
export const generateRandomGradient = () => {
  const randomIndex = Math.floor(Math.random() * gradientPresets.length);
  return gradientPresets[randomIndex];
};

// Create custom gradient from two colors
export const createCustomGradient = (color1, color2, angle = 135) => {
  return `linear-gradient(${angle}deg, ${color1} 0%, ${color2} 100%)`;
};
