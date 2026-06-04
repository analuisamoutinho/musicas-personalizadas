import type { Metadata } from "next";
import { env } from "@mascotinhos/env/web";
import Navbar from "@/components/landing/navbar";
import Footer from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Termos de Uso | Músicas Personalizadas",
  description:
    "Termos e condições do serviço Músicas Personalizadas: geração de ilustrações personalizadas via WhatsApp.",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/terms",
  },
};

export default function TermsPage() {
  const phoneNumber = env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  return (
    <>
      <Navbar phoneNumber={phoneNumber} />
      <main
        id="main-content"
        className="bg-surface min-h-screen pt-20"
        aria-labelledby="terms-heading"
      >
        <article className="max-w-3xl mx-auto px-6 py-16" lang="pt-BR">
          <h1
            id="terms-heading"
            className="text-3xl font-bold text-on-surface font-headline mb-4"
          >
            Termos de Uso
          </h1>
          <p className="text-sm text-on-surface-variant font-body mb-8">
            Última atualização: março de 2026
          </p>

          <p className="text-on-surface-variant font-body leading-relaxed mb-6">
            Bem-vindo à <strong className="text-on-surface">Músicas Personalizadas</strong>. Ao utilizar
            nosso serviço de geração de ilustrações personalizadas via WhatsApp, você concorda com
            estes Termos de Uso. Leia com atenção antes de realizar um pedido.
          </p>

          {/* 1. Descrição do Serviço */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            1. Descrição do Serviço
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            A Músicas Personalizadas oferece um serviço de geração de{" "}
            <strong className="text-on-surface">ilustrações digitais personalizadas</strong>{" "}
            ("mascotinhos") para festas infantis. O processo ocorre integralmente via WhatsApp:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>O responsável envia uma foto da criança e escolhe o tema desejado;</li>
            <li>O pagamento é realizado via PIX;</li>
            <li>A ilustração é gerada por inteligência artificial e entregue via WhatsApp.</li>
          </ul>

          {/* 2. Autorização Parental - ECA Digital */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            2. Autorização Parental e ECA Digital
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Em conformidade com a{" "}
            <strong className="text-on-surface">
              Lei 15.211/2025 (ECA Digital - Marco Legal de Proteção de Crianças e Adolescentes na Internet)
            </strong>
            , vigente a partir de março de 2026, que regula o uso de imagens de crianças e adolescentes em ambientes digitais, ao
            realizar um pedido o responsável declara e garante que:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>
              É o <strong className="text-on-surface">pai, mãe ou responsável legal</strong> da
              criança cuja imagem está sendo utilizada;
            </li>
            <li>
              Está ciente de que a imagem da criança será processada por sistemas de inteligência
              artificial para criar a ilustração solicitada;
            </li>
            <li>
              Autoriza expressamente o uso da imagem da criança{" "}
              <strong className="text-on-surface">
                exclusivamente para a geração da ilustração contratada
              </strong>
              , sem qualquer outro fim;
            </li>
            <li>
              Compreende que a imagem de referência será automaticamente excluída dos servidores 30
              dias após a entrega, conforme nossa Política de Privacidade.
            </li>
          </ul>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            A Músicas Personalizadas não utiliza imagens de crianças em materiais de marketing ou
            publicidade sem autorização individual e expressa por escrito do responsável legal.
          </p>

          {/* 3. Geração por Inteligência Artificial */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            3. Geração por Inteligência Artificial
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            As ilustrações são geradas por{" "}
            <strong className="text-on-surface">
              inteligência artificial (OpenAI GPT Image)
            </strong>
            . Ao realizar um pedido, o cliente reconhece e aceita que:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>
              A ilustração é criada por IA com base na foto de referência e nas instruções
              fornecidas, e pode não reproduzir com exatidão todos os traços físicos da criança;
            </li>
            <li>
              O resultado final é um produto artístico digital estilizado, não uma fotografia
              realista;
            </li>
            <li>
              A propriedade da ilustração gerada é transferida ao comprador, conforme os Termos de
              Uso da API da OpenAI que regem a transferência de outputs ao usuário da API.
            </li>
          </ul>

          {/* 4. Preço e Pagamento */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            4. Preço e Pagamento
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            O valor do serviço é de{" "}
            <strong className="text-on-surface">R$29,90 (vinte e nove reais e noventa centavos)</strong>{" "}
            por ilustração, sem custos adicionais. O pagamento é realizado exclusivamente via{" "}
            <strong className="text-on-surface">PIX</strong> por meio de QR Code enviado no
            WhatsApp.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            O pedido é confirmado e a geração da ilustração é iniciada{" "}
            <strong className="text-on-surface">somente após a confirmação do pagamento</strong>.
            Pagamentos não confirmados em 24 horas são automaticamente cancelados.
          </p>

          {/* 5. Entrega */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            5. Entrega
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Após a confirmação do pagamento, a ilustração é entregue via WhatsApp em{" "}
            <strong className="text-on-surface">
              aproximadamente 30 minutos
            </strong>{" "}
            (sujeito à fila de processamento). A entrega inclui:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>Arquivo de imagem digital em alta resolução;</li>
            <li>Arquivo em formato adequado para impressão (quando aplicável ao produto).</li>
          </ul>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Em caso de indisponibilidade técnica temporária, o prazo de entrega pode ser estendido.
            O cliente será notificado via WhatsApp sobre qualquer atraso significativo.
          </p>

          {/* 6. Política de Revisões */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            6. Política de Revisões
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Cada pedido inclui{" "}
            <strong className="text-on-surface">2 (duas) rodadas de revisão</strong> sem custo
            adicional. As revisões permitem ajustes como: cor de cabelo, expressão facial, acessórios,
            itens na mão da criança e outros detalhes visuais.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            O cliente deve enviar o feedback de revisão via WhatsApp em linguagem natural. Cada
            rodada de revisão gera uma nova ilustração, substituindo a anterior.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Revisões adicionais além das 2 rodadas incluídas ficam a critério da Músicas Personalizadas
            e podem implicar custo adicional, a ser acordado previamente.
          </p>

          {/* 7. Direito de Arrependimento - CDC */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            7. Direito de Arrependimento (CDC Art. 49)
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Conforme o{" "}
            <strong className="text-on-surface">
              Código de Defesa do Consumidor (CDC), Art. 49
            </strong>
            , o consumidor tem direito ao arrependimento no prazo de 7 (sete) dias a partir da
            contratação para compras realizadas fora do estabelecimento comercial.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            <strong className="text-on-surface">Atenção:</strong> Por se tratar de produto digital
            personalizado que é consumido no ato da entrega (ilustração criada especificamente para
            o cliente), o direito de arrependimento{" "}
            <strong className="text-on-surface">
              não se aplica após a entrega da ilustração finalizada
            </strong>
            , conforme jurisprudência consolidada para produtos digitais personalizados.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Caso o pedido ainda não tenha sido gerado (pagamento confirmado mas geração não
            iniciada), o cancelamento com reembolso integral pode ser solicitado via WhatsApp.
            Disputas de pagamento devem ser abertas diretamente com a operadora do PIX (Asaas).
          </p>

          {/* 8. Uso Permitido */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            8. Uso Permitido da Ilustração
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            A ilustração entregue pode ser utilizada pelo comprador para:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>Convites, lembranças e decoração de festas infantis;</li>
            <li>Impressão em topo de bolo, displays e materiais personalizados;</li>
            <li>Uso pessoal e compartilhamento em redes sociais do responsável.</li>
          </ul>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            É vedado ao comprador:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>Revender a ilustração como produto final a terceiros;</li>
            <li>Utilizar a ilustração para fins difamatórios, ofensivos ou ilegais;</li>
            <li>
              Reivindicar direitos autorais sobre a ilustração perante terceiros como se fosse obra
              própria humana.
            </li>
          </ul>

          {/* 9. Limitação de Responsabilidade */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            9. Limitação de Responsabilidade
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            A Músicas Personalizadas emprega melhores esforços para entregar ilustrações de alta
            qualidade. No entanto, por se tratar de geração por inteligência artificial, não
            garantimos semelhança perfeita com a criança. A política de revisões (2 rodadas) é o
            mecanismo previsto para adequar o resultado às expectativas do cliente.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Nossa responsabilidade se limita ao valor pago pelo pedido. Não nos responsabilizamos
            por danos indiretos, lucros cessantes ou expectativas não declaradas no momento do
            pedido.
          </p>

          {/* 10. Propriedade Intelectual */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            10. Propriedade Intelectual
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            A Músicas Personalizadas não reivindica propriedade sobre as ilustrações individuais
            entregues aos clientes. A propriedade do arquivo digital é do comprador, conforme
            disposto na cláusula 3.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Os templates de estilo, prompts e sistemas utilizados para gerar as ilustrações são
            propriedade exclusiva da Músicas Personalizadas e protegidos como segredo comercial.
          </p>

          {/* 11. Legislação Aplicável */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            11. Legislação Aplicável e Foro
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Estes Termos são regidos pela{" "}
            <strong className="text-on-surface">legislação brasileira</strong>. Eventuais litígios
            serão submetidos ao foro da Comarca de São Paulo, Estado de São Paulo, com renúncia a
            qualquer outro, por mais privilegiado que seja, salvo nos casos em que o CDC determinar
            o foro do domicílio do consumidor.
          </p>

          {/* 12. Alterações */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            12. Alterações nestes Termos
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Estes Termos podem ser atualizados periodicamente. A data da última atualização está
            indicada no topo desta página. O uso continuado do serviço após a publicação de
            alterações constitui aceitação dos novos termos.
          </p>

          {/* 13. Contato */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            13. Contato
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Para dúvidas, cancelamentos ou exercício de direitos, entre em contato via WhatsApp
            disponível no rodapé desta página.
          </p>

          <p className="text-sm text-on-surface-variant font-body mt-12 pt-6 bg-surface-container-low rounded px-3 py-2">
            Última atualização: março de 2026. Músicas Personalizadas
          </p>
        </article>
      </main>
      <Footer phoneNumber={phoneNumber} />
    </>
  );
}
