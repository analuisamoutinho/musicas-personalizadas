import Image from "next/image";

interface WhatsAppPreviewProps {
  scene: 1 | 2 | 3;
}

function CheckMarks() {
  return (
    <span className="inline-flex items-center text-[#34b7f1] text-[10px] leading-none ml-1" aria-hidden="true">
      ✓✓
    </span>
  );
}

function ReceivedBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="self-start max-w-[80%] bg-white rounded-lg rounded-tl-sm px-2.5 py-1.5 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] text-[11px] leading-snug text-on-surface">
      {children}
    </div>
  );
}

function SentBubble({
  children,
  time = "10:42",
}: {
  children: React.ReactNode;
  time?: string;
}) {
  return (
    <div className="self-end max-w-[80%] bg-[#d9fdd3] rounded-lg rounded-tr-sm px-2.5 py-1.5 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)] text-[11px] leading-snug text-on-surface">
      {children}
      <div className="flex items-center justify-end gap-0.5 -mb-1 mt-0.5 text-[9px] text-on-surface-variant">
        {time}
        <CheckMarks />
      </div>
    </div>
  );
}

export default function WhatsAppPreview({ scene }: WhatsAppPreviewProps) {
  return (
    <div className="w-full h-full flex flex-col rounded-md overflow-hidden bg-[#efeae2] shadow-inner">
      {/* WhatsApp header */}
      <div className="flex items-center gap-2 bg-[#075e54] text-white px-2.5 py-1.5">
        <div className="w-6 h-6 rounded-full bg-tertiary-container grid place-items-center text-[10px]" aria-hidden="true">
          🎈
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-[11px] font-bold leading-tight truncate">Estúdio Músicas Personalizadas</div>
          <div className="text-[9px] opacity-80 leading-tight">online</div>
        </div>
      </div>

      {/* Doodled chat area */}
      <div
        className="flex-1 flex flex-col gap-1.5 p-2 overflow-hidden"
        style={{
          backgroundImage:
            "radial-gradient(rgba(177,11,104,0.06) 1px, transparent 1px), radial-gradient(rgba(0,95,156,0.05) 1px, transparent 1px)",
          backgroundSize: "12px 12px, 18px 18px",
          backgroundPosition: "0 0, 6px 6px",
        }}
      >
        {scene === 1 && (
          <>
            <ReceivedBubble>Oi! Manda uma foto bem fofa 💛</ReceivedBubble>
            <div className="self-end max-w-[90%] bg-[#d9fdd3] rounded-lg rounded-tr-sm p-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
              <div className="relative w-full aspect-[4/5] rounded overflow-hidden">
                <Image
                  src="/images/portfolio/before-1.jpg"
                  alt=""
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
              <div className="flex items-center justify-end gap-0.5 px-0.5 pt-0.5 text-[9px] text-on-surface-variant">
                10:42
                <CheckMarks />
              </div>
            </div>
          </>
        )}

        {scene === 2 && (
          <>
            <ReceivedBubble>Qual cenário você quer?</ReceivedBubble>
            <SentBubble time="10:43">Princesa 👑</SentBubble>
          </>
        )}

        {scene === 3 && (
          <>
            <div className="self-start max-w-[90%] bg-white rounded-lg rounded-tl-sm p-1 shadow-[0_1px_0.5px_rgba(0,0,0,0.13)]">
              <div className="relative w-full aspect-[4/5] rounded overflow-hidden">
                <Image
                  src="/images/portfolio/after-princesa.png"
                  alt=""
                  fill
                  sizes="200px"
                  className="object-cover"
                />
              </div>
              <div className="px-0.5 pt-0.5 text-[9px] text-on-surface-variant">10:48</div>
            </div>
            <ReceivedBubble>Pronto! 💛</ReceivedBubble>
            <SentBubble time="10:48">AAAAH 😍</SentBubble>
          </>
        )}
      </div>
    </div>
  );
}
