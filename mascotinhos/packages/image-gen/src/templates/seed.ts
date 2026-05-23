/**
 * Style template seed data for initial StyleTemplate library.
 * These templates are loaded into the database via packages/db/prisma/seed.ts.
 *
 * promptTemplate: 150-250 word English prompt optimized for GPT Image 1.5.
 * Placeholders {theme}, {outfit}, {extras} are informational for enrich-prompt.ts GPT-5-mini merge.
 * exampleImages: empty array for MVP — operator uploads real images separately.
 */

export interface SeedTemplate {
  name: string;
  slug: string;
  promptTemplate: string;
  exampleImages: string[];
  tags: string[];
  productType: "MASCOTINHO";
  active: boolean;
  popularity: number;
}

export const seedTemplates: SeedTemplate[] = [
  {
    name: "Princesa",
    slug: "princesa",
    promptTemplate: `A soft watercolor and digital illustration of a cute Brazilian child mascot character in a magical princess setting. The child is dressed in {outfit} — a flowing princess gown with delicate lace details, sparkling tiara, and small matching heels. The scene is set in an enchanted castle courtyard surrounded by blooming pink and lavender roses, golden fairy lights, and shimmering butterflies. The color palette is warm and pastel: rose pinks, lilac purples, cream whites, and soft gold accents. The lighting is gentle and dreamy, with a soft golden hour glow. Additional elements: {extras}. The character has large expressive eyes, rosy cheeks, and a joyful smile. Style: children's book illustration meets high-quality digital art, soft gradients, rounded shapes, extremely child-friendly and charming. The composition centers the child character with the magical castle visible in the background. Subject theme: {theme}. Render quality: high-detail, vibrant, joyful, suitable for printing on a child's birthday gift.`,
    exampleImages: [],
    tags: ["princesa", "fantasia", "menina", "realeza"],
    productType: "MASCOTINHO",
    active: true,
    popularity: 0,
  },
  {
    name: "Safari",
    slug: "safari",
    promptTemplate: `A vibrant digital illustration of a cute Brazilian child mascot character on a fun safari adventure. The child is dressed in {outfit} — classic safari khaki shorts or dress, a wide-brimmed explorer hat, and brown boots with a small backpack. The scene is set in a lush African savanna with acacia trees, golden grass, and a bright blue sky with fluffy white clouds. Friendly cartoon animals surround the child: a giraffe peeking over the child's shoulder, a zebra grazing nearby, and a playful lion cub at their feet. The color palette is warm and earthy: golden yellows, warm oranges, sage greens, and sky blues. The lighting is bright and sunny, mid-day adventure feel. Additional elements: {extras}. The character has large curious eyes, a wide adventurous smile, and rosy cheeks. Style: bright children's book illustration with bold outlines, vivid colors, and whimsical cartoon animals. The composition places the child front and center with the savanna landscape stretching behind. Subject theme: {theme}. Render quality: high-detail, colorful, energetic, print-ready.`,
    exampleImages: [],
    tags: ["safari", "animais", "aventura", "natureza"],
    productType: "MASCOTINHO",
    active: true,
    popularity: 0,
  },
  {
    name: "Jardim Encantado",
    slug: "jardim-encantado",
    promptTemplate: `A magical soft-glow digital illustration of a cute Brazilian child mascot character in an enchanted fairy garden. The child is dressed in {outfit} — a delicate flower fairy outfit with petal wings, floral crown, and tiny sparkling shoes. The scene is set in a lush magical garden with oversized colorful flowers, glowing mushrooms, fireflies, and tiny fairies flying around. Dew drops sparkle on large tropical leaves. The color palette is vibrant and magical: emerald greens, coral pinks, sky blues, sunshine yellows, and lavender purples. The lighting is soft and ethereal with a warm golden magic glow filtering through the leaves. Additional elements: {extras}. The character has wide wonder-filled eyes, a delighted smile, and a sprinkle of fairy dust around them. Style: whimsical children's illustration with a fairytale quality, soft bokeh background, gentle gradients, and magical sparkle effects. The composition places the child at the heart of the garden with flowers framing the scene. Subject theme: {theme}. Render quality: high-detail, dreamy, magical, vibrant, perfect for children's prints.`,
    exampleImages: [],
    tags: ["jardim", "fadas", "flores", "magico"],
    productType: "MASCOTINHO",
    active: true,
    popularity: 0,
  },
  {
    name: "Sereia",
    slug: "sereia",
    promptTemplate: `A luminous underwater digital illustration of a cute Brazilian child mascot character as a beautiful little mermaid. The child is depicted with {outfit} — a shimmering iridescent mermaid tail in turquoise and aquamarine, a seashell top, and flowing hair adorned with pearls, starfish, and coral. The underwater scene is vibrant and magical: colorful coral reefs, tropical fish in rainbow colors, gentle sea bubbles, and rays of golden sunlight filtering through crystal-clear ocean water. The color palette is cool and jewel-toned: turquoise blues, aquamarine greens, pearl whites, coral pinks, and sea foam. The lighting is soft underwater glow with scattered light caustics. Additional elements: {extras}. The character has large sparkling eyes reflecting the ocean light, a joyful smile, and graceful flowing hair. Style: enchanting children's illustration with a magical realism quality, luminous water effects, and vibrant marine life. The composition shows the mermaid child swimming gracefully with sea creatures around them. Subject theme: {theme}. Render quality: high-detail, luminous, magical, vibrant underwater colors.`,
    exampleImages: [],
    tags: ["sereia", "oceano", "fantasia", "menina"],
    productType: "MASCOTINHO",
    active: true,
    popularity: 0,
  },
  {
    name: "Super-Heroi",
    slug: "super-heroi",
    promptTemplate: `A dynamic and energetic digital illustration of a cute Brazilian child mascot character as a confident superhero. The child is dressed in {outfit} — a colorful superhero costume with a cape billowing dramatically in the wind, matching boots and gloves, and a bold emblem on the chest. The scene is set in a vibrant cityscape with skyscrapers in the background, a bright blue sky, and a few fluffy clouds. The child strikes a heroic pose with fists on hips or cape flying mid-leap. The color palette is bold and vibrant: electric blues, bright reds, golden yellows, and white highlights. The lighting is dramatic with a hero spotlight effect and dynamic energy lines. Additional elements: {extras}. The character has determined sparkling eyes, a brave confident smile, and a sense of invincibility. Style: bold graphic novel meets children's illustration, strong outlines, vibrant flat colors with dynamic shading, and action-oriented composition. The child is the undeniable hero of the scene. Subject theme: {theme}. Render quality: high-detail, dynamic, bold, energetic, print-ready.`,
    exampleImages: [],
    tags: ["super-heroi", "acao", "poderes", "aventura"],
    productType: "MASCOTINHO",
    active: true,
    popularity: 0,
  },
  {
    name: "Astronauta",
    slug: "astronauta",
    promptTemplate: `A wonder-filled space digital illustration of a cute Brazilian child mascot character as an adorable little astronaut exploring the cosmos. The child is dressed in {outfit} — a rounded white space suit with a clear helmet visor, mission patches on the arms, and floating in zero gravity. The scene is set in outer space with a stunning view of Earth below, colorful nebulae in the distance, sparkling stars, a friendly rocket ship nearby, and cartoon planets with rings. The color palette is deep and cosmic: midnight blues, purple nebulae, silver whites, golden star bursts, and vibrant planet colors. The lighting is the dramatic glow of stars and Earth's reflection. Additional elements: {extras}. The character has wide eyes filled with wonder and excitement, a big smile visible through the helmet, and a sense of infinite possibility. Style: dreamlike children's space illustration with a sense of awe, soft cosmic glow effects, rounded friendly shapes, and imaginative sci-fi elements. Subject theme: {theme}. Render quality: high-detail, cosmic, wonder-inspiring, vibrant, perfect for adventurous children.`,
    exampleImages: [],
    tags: ["astronauta", "espaco", "ciencia", "aventura"],
    productType: "MASCOTINHO",
    active: true,
    popularity: 0,
  },
  {
    name: "Fazendinha",
    slug: "fazendinha",
    promptTemplate: `A warm and cheerful countryside digital illustration of a cute Brazilian child mascot character on a joyful little farm. The child is dressed in {outfit} — cute overalls or a floral dress, a straw hat, and small rubber boots perfect for the farm. The scene is set on a charming Brazilian fazendinha with a red barn, rolling green hills, a bright blue sky, and fluffy white clouds. Friendly farm animals surround the child: a spotted cow, a fluffy lamb, baby chicks, and a rooster perched on a fence. A sunflower field blooms in the background. The color palette is warm and cheerful: grass greens, sunshine yellows, barn reds, sky blues, and earth browns. The lighting is warm golden morning sunlight. Additional elements: {extras}. The character has bright happy eyes, muddy boots, and the biggest smile of pure country joy. Style: warm children's book illustration with a cozy rural aesthetic, rounded friendly animals, soft natural colors, and a sense of wholesome fun. Subject theme: {theme}. Render quality: high-detail, warm, joyful, charming, print-ready.`,
    exampleImages: [],
    tags: ["fazenda", "animais", "campo", "natureza"],
    productType: "MASCOTINHO",
    active: true,
    popularity: 0,
  },
];
