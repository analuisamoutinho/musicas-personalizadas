import Image from "next/image";

interface PortfolioCardProps {
  originalSrc: string;
  mascotinhoSrc: string;
  styleName: string;
  originalAlt: string;
  mascotinhoAlt: string;
}

export default function PortfolioCard({
  originalSrc,
  mascotinhoSrc,
  styleName,
  originalAlt,
  mascotinhoAlt,
}: PortfolioCardProps) {
  return (
    <div role="group" aria-label={`${styleName}: antes e depois`} className="bg-surface-container-lowest rounded-xl shadow-xl overflow-hidden">
      <div className="grid grid-cols-2">
        <div className="relative overflow-hidden">
          <Image
            src={originalSrc}
            alt={originalAlt}
            width={400}
            height={400}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
            className="w-full aspect-[3/4] object-cover object-top grayscale opacity-80"
            loading="lazy"
          />
          <span className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-bold px-2 py-1 rounded-full backdrop-blur-md">
            ORIGINAL
          </span>
        </div>
        <div className="relative overflow-hidden">
          <Image
            src={mascotinhoSrc}
            alt={mascotinhoAlt}
            width={400}
            height={400}
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
            className="w-full aspect-[3/4] object-cover"
            loading="lazy"
          />
          <span className="absolute bottom-2 right-2 bg-primary text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg">
            MASCOTINHO
          </span>
        </div>
      </div>
      <p className="text-center py-3 text-sm font-semibold text-on-surface font-headline">
        {styleName}
      </p>
    </div>
  );
}
