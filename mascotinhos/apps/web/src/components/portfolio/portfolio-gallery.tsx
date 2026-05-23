import PortfolioCard from "./portfolio-card";

const portfolioPairs = [
  {
    id: 1,
    originalSrc: "/images/portfolio/before-1.jpg",
    mascotinhoSrc: "/images/portfolio/after-princesa.png",
    styleName: "Princesa",
    originalAlt: "Foto original de criança com cabelos cacheados loiros e jardineira jeans",
    mascotinhoAlt: "Mascotinho estilo Princesa com vestido rosa e tiara em castelo encantado",
  },
  {
    id: 2,
    originalSrc: "/images/portfolio/before-2.jpg",
    mascotinhoSrc: "/images/portfolio/after-super-heroi.png",
    styleName: "Super-Heroi",
    originalAlt: "Foto original de criança sorrindo com roupa azul e gravata borboleta",
    mascotinhoAlt: "Mascotinho estilo Super-Heroi com capa vermelha e emblema dourado",
  },
  {
    id: 3,
    originalSrc: "/images/portfolio/before-1.jpg",
    mascotinhoSrc: "/images/portfolio/after-sereia.png",
    styleName: "Sereia",
    originalAlt: "Foto original de criança com cabelos cacheados loiros e jardineira jeans",
    mascotinhoAlt: "Mascotinho estilo Sereia com cauda turquesa em fundo submarino",
  },
  {
    id: 4,
    originalSrc: "/images/portfolio/before-2.jpg",
    mascotinhoSrc: "/images/portfolio/after-safari.png",
    styleName: "Safari",
    originalAlt: "Foto original de criança sorrindo com roupa azul e gravata borboleta",
    mascotinhoAlt: "Mascotinho estilo Safari com chapéu de explorador e animais na savana",
  },
  {
    id: 5,
    originalSrc: "/images/portfolio/before-1.jpg",
    mascotinhoSrc: "/images/portfolio/after-astronauta.png",
    styleName: "Astronauta",
    originalAlt: "Foto original de criança com cabelos cacheados loiros e jardineira jeans",
    mascotinhoAlt: "Mascotinho estilo Astronauta flutuando no espaço com ursinho",
  },
  {
    id: 6,
    originalSrc: "/images/portfolio/before-2.jpg",
    mascotinhoSrc: "/images/portfolio/after-fazendinha.png",
    styleName: "Fazendinha",
    originalAlt: "Foto original de criança sorrindo com roupa azul e gravata borboleta",
    mascotinhoAlt: "Mascotinho estilo Fazendinha com chapéu de palha e animais da fazenda",
  },
];

export default function PortfolioGallery() {
  return (
    <section aria-labelledby="portfolio-heading" id="portfolio" className="bg-surface-container py-20">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-12">
          <h2 id="portfolio-heading" className="text-3xl font-bold text-on-surface font-headline">
            Veja a transformação
          </h2>
          <p className="text-on-surface-variant mt-2 max-w-xl mx-auto font-body">
            De uma foto comum para um mascotinho memorável.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {portfolioPairs.map((pair) => (
            <PortfolioCard key={pair.id} {...pair} />
          ))}
        </div>
      </div>
    </section>
  );
}
