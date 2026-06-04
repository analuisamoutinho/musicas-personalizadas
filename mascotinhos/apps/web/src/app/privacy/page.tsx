import type { Metadata } from "next";
import { env } from "@mascotinhos/env/web";
import Navbar from "@/components/landing/navbar";
import Footer from "@/components/landing/footer";

export const metadata: Metadata = {
  title: "Política de Privacidade | Músicas Personalizadas",
  description:
    "Como tratamos os seus dados e os dados do seu filho conforme a LGPD (Lei 13.709/2018).",
  robots: { index: false, follow: false },
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  const phoneNumber = env.NEXT_PUBLIC_WHATSAPP_NUMBER;

  return (
    <>
      <Navbar phoneNumber={phoneNumber} />
      <main
        id="main-content"
        className="bg-surface min-h-screen pt-20"
        aria-labelledby="privacy-heading"
      >
        <article className="max-w-3xl mx-auto px-6 py-16" lang="pt-BR">
          <h1
            id="privacy-heading"
            className="text-3xl font-bold text-on-surface font-headline mb-4"
          >
            Política de Privacidade
          </h1>
          <p className="text-sm text-on-surface-variant font-body mb-8">
            Última atualização: março de 2026
          </p>

          <p className="text-on-surface-variant font-body leading-relaxed mb-6">
            A <strong className="text-on-surface">Músicas Personalizadas</strong> respeita a sua
            privacidade e a de seu filho. Esta Política de Privacidade descreve como coletamos,
            usamos e protegemos os seus dados pessoais em conformidade com a{" "}
            <strong className="text-on-surface">Lei Geral de Proteção de Dados Pessoais (LGPD - Lei 13.709/2018)</strong>{" "}
            e, especialmente, com as disposições do{" "}
            <strong className="text-on-surface">Art. 14 da LGPD</strong>, que trata de dados de
            crianças e adolescentes.
          </p>

          {/* 1. Controlador de Dados */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            1. Controlador de Dados
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            O controlador dos seus dados pessoais é a <strong className="text-on-surface">Músicas Personalizadas</strong>,
            operada por um microempreendedor individual (MEI) com sede no Brasil. Para entrar em
            contato com nosso responsável pela proteção de dados (DPO), utilize nosso canal de
            atendimento via WhatsApp disponível no rodapé desta página.
          </p>

          {/* 2. Dados que Coletamos */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            2. Dados que Coletamos
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Coletamos apenas os dados estritamente necessários para a prestação do serviço
            (princípio da minimização de dados - LGPD Art. 6º, III):
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>
              <strong className="text-on-surface">Número de WhatsApp</strong>: identificação do
              cliente e canal de entrega
            </li>
            <li>
              <strong className="text-on-surface">Primeiro nome do responsável</strong>: para
              personalização do atendimento
            </li>
            <li>
              <strong className="text-on-surface">Foto de referência da criança</strong>: enviada
              voluntariamente pelo responsável para geração da ilustração; tratada como dado
              especial conforme LGPD Art. 14
            </li>
            <li>
              <strong className="text-on-surface">Detalhes do pedido</strong>: tema escolhido,
              descrição do traje e solicitações adicionais
            </li>
            <li>
              <strong className="text-on-surface">Registro de consentimento</strong>: data e hora
              em que o responsável forneceu o consentimento explícito
            </li>
          </ul>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            <strong className="text-on-surface">Não coletamos</strong> CPF, endereço físico,
            e-mail ou qualquer outro dado além dos listados acima.
          </p>

          {/* 3. Dados de Crianças */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            3. Dados de Crianças: Tratamento Especial
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            A foto de referência é um dado pessoal de criança ou adolescente (menor de 18 anos), sujeito ao regime
            protetivo especial da <strong className="text-on-surface">LGPD Art. 14</strong>. O
            tratamento desse dado somente é realizado:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>Com o consentimento explícito do responsável legal da criança;</li>
            <li>Exclusivamente para a finalidade declarada: geração da ilustração personalizada;</li>
            <li>
              Em observância ao princípio da finalidade (LGPD Art. 6º, I): a foto nunca é
              reutilizada para treinamento de modelos, marketing ou qualquer outro fim.
            </li>
          </ul>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Ao enviar a foto da criança pelo WhatsApp, o responsável confirma que é o
            pai/mãe/tutor legal da criança e que autoriza o uso da imagem exclusivamente para a
            geração da arte solicitada.
          </p>

          {/* 4. Finalidade e Base Legal */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            4. Finalidade e Base Legal
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Tratamos os seus dados com base nas seguintes hipóteses legais da LGPD:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>
              <strong className="text-on-surface">Consentimento (Art. 7º, I e Art. 14)</strong>:
              para o uso da foto de referência da criança
            </li>
            <li>
              <strong className="text-on-surface">Execução de contrato (Art. 7º, V)</strong>:
              para processar o pedido, gerar a ilustração e entregá-la via WhatsApp
            </li>
            <li>
              <strong className="text-on-surface">Legítimo interesse (Art. 7º, IX)</strong>:
              para manter registros de pedidos e resolver eventuais disputas
            </li>
          </ul>

          {/* 5. Exclusão Automática de Fotos */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            5. Exclusão Automática da Foto de Referência
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            A foto de referência da criança é automaticamente excluída dos nossos servidores{" "}
            <strong className="text-on-surface">30 dias após a entrega do pedido</strong>. Essa
            exclusão é realizada de forma automática e irreversível, sem necessidade de solicitação
            do responsável.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            A ilustração gerada (mascotinho) <strong className="text-on-surface">não</strong> é
            considerada dado pessoal da criança após o processo de geração e permanece disponível
            para re-download pelo prazo de 30 dias. Após esse prazo, também é excluída.
          </p>

          {/* 6. Suboperador: OpenAI */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            6. Suboperador de Dados: OpenAI
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Para gerar a ilustração personalizada, a foto de referência é transmitida de forma
            segura para a{" "}
            <strong className="text-on-surface">OpenAI Inc.</strong> (San Francisco, EUA), que atua
            como suboperador de dados na modalidade de processamento de imagens via API.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            A Músicas Personalizadas mantém um{" "}
            <strong className="text-on-surface">Acordo de Processamento de Dados (DPA)</strong> com
            a OpenAI, conforme exigido pela LGPD para transferências internacionais de dados (Art.
            33). A OpenAI se compromete contratualmente a não usar os dados de API para treinar seus
            modelos.
          </p>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Para mais informações sobre as práticas de privacidade da OpenAI, acesse:{" "}
            <a
              href="https://openai.com/privacy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none rounded"
            >
              openai.com/privacy
            </a>
          </p>

          {/* 7. Segurança */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            7. Segurança dos Dados
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Adotamos medidas técnicas e organizacionais adequadas para proteger seus dados:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>Transmissão de dados via HTTPS (TLS 1.2+)</li>
            <li>Armazenamento em Supabase Storage com criptografia em repouso (AES-256)</li>
            <li>Acesso restrito aos dados apenas por sistemas automatizados do serviço</li>
            <li>URLs de acesso às fotos com expiração automática (signed URLs)</li>
            <li>Chaves de API e credenciais armazenadas em variáveis de ambiente protegidas</li>
          </ul>

          {/* 8. Seus Direitos */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            8. Seus Direitos como Titular (LGPD Art. 18)
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Você tem os seguintes direitos em relação aos seus dados e aos dados do seu filho:
          </p>
          <ul className="list-disc list-inside space-y-2 text-on-surface-variant font-body mb-4 ml-2">
            <li>
              <strong className="text-on-surface">Confirmação e acesso</strong>: saber se
              tratamos seus dados e obter uma cópia
            </li>
            <li>
              <strong className="text-on-surface">Correção</strong>: corrigir dados incompletos
              ou inexatos
            </li>
            <li>
              <strong className="text-on-surface">Eliminação</strong>: solicitar a exclusão dos
              seus dados antes do prazo automático de 30 dias
            </li>
            <li>
              <strong className="text-on-surface">Portabilidade</strong>: receber seus dados em
              formato estruturado
            </li>
            <li>
              <strong className="text-on-surface">Revogação do consentimento</strong>: retirar o
              consentimento a qualquer momento, sem prejuízo do tratamento já realizado
            </li>
            <li>
              <strong className="text-on-surface">Informação sobre compartilhamento</strong>:
              saber com quais entidades compartilhamos seus dados
            </li>
          </ul>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Para exercer qualquer desses direitos, entre em contato conosco pelo WhatsApp disponível
            no rodapé desta página. Responderemos em até 15 dias úteis.
          </p>

          {/* 9. ANPD */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            9. Direito de Petição à ANPD
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Caso considere que o tratamento dos seus dados viola a LGPD, você tem o direito de
            peticionar à{" "}
            <strong className="text-on-surface">
              Autoridade Nacional de Proteção de Dados (ANPD)
            </strong>{" "}
            por meio do portal{" "}
            <a
              href="https://www.gov.br/anpd"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none rounded"
            >
              gov.br/anpd
            </a>
            .
          </p>

          {/* 10. Alterações */}
          <h2 className="text-xl font-bold text-on-surface font-headline mt-10 mb-4">
            10. Alterações nesta Política
          </h2>
          <p className="text-on-surface-variant font-body leading-relaxed mb-4">
            Esta política pode ser atualizada periodicamente. A data da última atualização está
            indicada no topo desta página. Alterações significativas serão comunicadas via WhatsApp
            aos clientes ativos.
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
