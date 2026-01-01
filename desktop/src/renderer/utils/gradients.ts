// Predefined gradient presets for viewer backgrounds

export interface GradientPreset {
  id: string;
  name: string;
  value: string;
}

export const gradientPresets: GradientPreset[] = [
  {
    id: 'ocean-blue',
    name: 'Ocean Blue',
    value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
  },
  {
    id: 'sunset',
    name: 'Sunset',
    value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
  },
  {
    id: 'forest',
    name: 'Forest',
    value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)'
  },
  {
    id: 'fire',
    name: 'Fire',
    value: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)'
  },
  {
    id: 'purple-dream',
    name: 'Purple Dream',
    value: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)'
  },
  {
    id: 'deep-space',
    name: 'Deep Space',
    value: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)'
  },
  {
    id: 'cherry-blossom',
    name: 'Cherry Blossom',
    value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)'
  },
  {
    id: 'northern-lights',
    name: 'Northern Lights',
    value: 'linear-gradient(135deg, #a8caba 0%, #5d4e6d 100%)'
  },
  {
    id: 'tropical',
    name: 'Tropical',
    value: 'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)'
  },
  {
    id: 'royal-purple',
    name: 'Royal Purple',
    value: 'linear-gradient(135deg, #868f96 0%, #596164 100%)'
  },
  {
    id: 'candy',
    name: 'Candy',
    value: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 100%)'
  },
  {
    id: 'sea-breeze',
    name: 'Sea Breeze',
    value: 'linear-gradient(135deg, #2af598 0%, #009efd 100%)'
  },
  {
    id: 'autumn',
    name: 'Autumn',
    value: 'linear-gradient(135deg, #f77062 0%, #fe5196 100%)'
  },
  {
    id: 'midnight',
    name: 'Midnight',
    value: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)'
  },
  {
    id: 'spring',
    name: 'Spring',
    value: 'linear-gradient(135deg, #96fbc4 0%, #f9f586 100%)'
  },
  {
    id: 'peacock',
    name: 'Peacock',
    value: 'linear-gradient(135deg, #20E2D7 0%, #F9FEA5 100%)'
  },
  {
    id: 'rose-gold',
    name: 'Rose Gold',
    value: 'linear-gradient(135deg, #f4c4f3 0%, #fc67fa 100%)'
  },
  {
    id: 'desert',
    name: 'Desert',
    value: 'linear-gradient(135deg, #ffa751 0%, #ffe259 100%)'
  },
  {
    id: 'ice',
    name: 'Ice',
    value: 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)'
  },
  {
    id: 'lava',
    name: 'Lava',
    value: 'linear-gradient(135deg, #ff0844 0%, #ffb199 100%)'
  },
  {
    id: 'solid-black',
    name: 'Solid Black',
    value: '#000000'
  },
  {
    id: 'solid-dark',
    name: 'Dark Gray',
    value: '#1a1a2e'
  }
];

// Check if a value is a gradient (vs solid color)
export const isGradient = (value: string): boolean => {
  return value.startsWith('linear-gradient') || value.startsWith('radial-gradient');
};
