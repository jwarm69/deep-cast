const ADJECTIVES = [
  'Sneaky', 'Sleepy', 'Grumpy', 'Lucky', 'Dizzy', 'Salty', 'Crispy',
  'Wobbly', 'Soggy', 'Rusty', 'Chunky', 'Funky', 'Sketchy', 'Shady',
  'Crusty', 'Frosty', 'Dusty', 'Mushy', 'Toasty', 'Janky', 'Spicy',
  'Crunchy', 'Muddy', 'Breezy', 'Cheeky', 'Gloomy', 'Peppy', 'Rowdy',
  'Nerdy', 'Wacky', 'Zesty', 'Mighty', 'Quirky', 'Snarky', 'Twisty',
];

const NOUNS = [
  'Trout', 'Shrimp', 'Squid', 'Sardine', 'Walrus', 'Pelican', 'Otter',
  'Catfish', 'Lobster', 'Manatee', 'Tadpole', 'Penguin', 'Barnacle',
  'Anchovy', 'Flounder', 'Crawdad', 'Narwhal', 'Mackerel', 'Sturgeon',
  'Minnow', 'Herring', 'Piranha', 'Grouper', 'Snapper', 'Blowfish',
  'Starfish', 'Swordfish', 'Jellyfish', 'Mudskipper', 'Barracuda',
  'Stingray', 'Seahorse', 'Clownfish', 'Pufferfish', 'Cuttlefish',
];

const DISPLAY_NAME_KEY = 'deep-cast-display-name';

export function generateFishName(): string {
  const stored = localStorage.getItem(DISPLAY_NAME_KEY);
  if (stored) return stored;

  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const noun = NOUNS[Math.floor(Math.random() * NOUNS.length)];
  const name = `${adj}${noun}`;

  localStorage.setItem(DISPLAY_NAME_KEY, name);
  return name;
}
