// Textes du site en portugais du Brésil (pt-BR). Seule la homepage est
// traduite (lib/localeRouting.ts, LOCALE_PATHS) : les autres sections
// reprennent l'anglais, servi à leur place. Ton : voir ./README.md.
import en from './en'
import type { Copy } from './fr'

const pt: Copy = {
  ...en,
  layout: {
    pricing: 'Preços',
    download: 'Baixar o app',
    myProfile: 'Meu perfil',
    myAccount: 'Minha conta',
    myShares: 'Meus compartilhamentos',
    signOut: 'Sair',
    signUp: 'Criar conta',
    signIn: 'Entrar',
    newHere: 'Ainda não tem cadastro?',
    openMenu: 'Abrir o menu',
    closeMenu: 'Fechar o menu',
    footerTagline: 'Fotografe suas coisas, o Tiroir escreve a ficha. Seu inventário, enfim em dia.',
    product: 'Produto',
    project: 'O projeto',
    about: 'Sobre',
    bookSlot: 'Agendar um horário',
    bookSubject: 'Conversar sobre o Tiroir',
    legal: 'Legal',
    terms: 'Termos de uso',
    privacy: 'Privacidade',
    madeIn: 'Feito na França',
    contact: 'Contato',
    language: 'Idioma',
  },

  home: {
    meta: {
      title: 'Tiroir — uma foto, e suas coisas estão organizadas',
      description: 'Fotografe um objeto: o Tiroir escreve a ficha, organiza e estima o valor. Para criativos, profissionais e todo mundo que quer saber o que tem.',
    },
    hero: {
      badge: 'Disponível para iOS e Android',
      variants: [
        {
          title: 'Uma foto, e tudo o que você tem fica organizado.',
          sub: 'O Tiroir escreve a ficha de cada objeto por você, com categoria, estado e valor.',
        },
        {
          title: 'Saiba de uma vez o que você tem e quanto vale.',
          sub: 'O Tiroir escreve a ficha de cada objeto por você, com categoria, estado e valor.',
        },
        {
          title: 'Seu inventário se faz sozinho.',
          sub: 'Tire uma foto, o Tiroir cuida do resto. Não precisa entender de tecnologia.',
        },
      ],
      free: 'Grátis para começar',
      demoLabel: 'Demonstração: a foto de um relógio vira uma ficha completa, com o valor estimado.',
      steps: ['Foto', 'Ficha', 'Valor'],
      object: {
        ready: 'Ficha pronta',
        name: 'Relógio vintage',
        meta: 'Anos 1970 · aço',
        rows: [
          ['Categoria', 'Relojoaria'],
          ['Coleção', 'Vitrine'],
          ['Estado', 'Muito bom'],
        ],
        valueLabel: 'Valor estimado',
      },
    },
    photo: {
      title: 'Uma foto. Só isso.',
      sub: 'O Torix, a IA do Tiroir, reconhece seu objeto e preenche a ficha. Você só escolhe a gaveta.',
      steps: [
        { title: 'Você tira a foto', text: 'Um objeto, uma foto. Nenhum formulário para preencher.' },
        { title: 'O Torix preenche a ficha', text: 'Nome, categoria, estado: tudo se escreve sozinho. Você corrige se quiser.' },
        { title: 'Está guardado', text: 'Você escolhe a gaveta enquanto o Torix trabalha. Depois, encontra tudo num instante.' },
      ],
      fiche: { name: 'Jaqueta jeans', rows: [['Categoria', 'Roupas'], ['Estado', 'Bom']], estimate: 'Valor', estimateCta: '✦ Estimar' },
      drawer: 'Guarda-roupa',
      stored: 'Guardada',
      video: {
        label: 'Vídeo de demonstração: a foto de um objeto vira uma ficha completa, guardada numa gaveta.',
        badge: '10 segundos',
        play: 'Reproduzir o vídeo',
        pause: 'Pausar o vídeo',
      },
      reassure: 'Grátis, sem cartão de crédito. {n} ações de IA por mês incluídas.',
      cta: 'Experimentar grátis',
    },
    creatives: {
      eyebrow: 'Para criativos',
      title: 'Seu equipamento sob controle.',
      sub: 'Câmeras, lentes, peças de figurino: saiba o que você tem, onde está e quanto vale.',
      soon: 'Em breve',
      points: [
        { title: 'Encontre tudo', text: 'Cada peça é fotografada e organizada por coleção. Encontre-a em poucos segundos antes de uma gravação.' },
        { title: 'Conheça o valor', text: 'O Torix estimará cada peça automaticamente, e um gráfico acompanhará o valor ao longo do tempo.', soon: true },
        { title: 'Compartilhe com segurança', text: 'Envie uma lista somente para visualização a um assistente ou a uma locadora, sem expor mais nada.' },
      ],
      card: {
        label: 'Prévia: a ficha de uma câmera fotográfica, com a estimativa e o gráfico do valor em doze meses.',
        preview: 'Prévia',
        name: 'Câmera analógica',
        meta: 'Coleção Gravação · guardada',
        estimateLabel: 'Estimativa Torix',
        trendLabel: 'Valor em 12 meses',
      },
      bridge: 'Precisa de uma exportação para o seu seguro ou de estimar todo um acervo de uma só vez?',
      bridgeLink: 'Conheça o plano Pro.',
      cta: 'Conhecer o Premium',
      ctaNote: 'Plano em breve: preços e detalhes na página Preços.',
    },
    pro: {
      eyebrow: 'Para profissionais',
      badge: 'Planos em breve',
      title: 'Seu inventário, um ativo sob controle.',
      sub: 'Você poderá estimar, documentar e comprovar o valor de todo o seu acervo.',
      points: [
        { title: 'IA incluída', text: 'Os créditos de IA estarão incluídos no seu plano, sem recargas a prever. O Torix estimará cada objeto automaticamente.' },
        { title: 'Estimativa em lote', text: 'Você estimará todo um acervo em uma única operação.' },
        { title: 'Fontes detalhadas', text: 'Você consultará o detalhamento das fontes de cada estimativa, para comprová-la.' },
        { title: 'Exportação para seguro', text: 'Você gerará uma exportação pronta para enviar à sua seguradora.' },
      ],
      ctaPro: 'Conhecer o plano Pro',
      ctaNote: 'Plano em breve: preços e detalhes na página Preços.',
      business: {
        title: 'Para empresas',
        text: 'Todos os recursos do Pro, com faturamento mensal por fatura, pago por transferência bancária ou débito automático.',
        cta: 'Fale conosco',
      },
      preview: {
        label: 'Prévia fictícia de uma exportação para seguro: quatro objetos estimados em lote e o valor total.',
        title: 'Exportação para seguro',
        tag: 'Dados fictícios',
        subtitle: 'Acervo de equipamentos · estimado em lote',
        cols: ['Objeto', 'Categoria', 'Valor'],
        rows: [['Câmera de cinema', 'Imagem'], ['Lente 35 mm', 'Óptica'], ['Tripé de vídeo', 'Maquinaria'], ['Monitor de campo', 'Imagem']],
        total: 'Total estimado',
      },
    },
    everyone: {
      eyebrow: 'E para todo mundo',
      title: 'Não precisa ser profissional. Nem entender de tecnologia.',
      sub: 'Se você sabe tirar uma foto, sabe usar o Tiroir.',
      points: [
        { title: 'Nenhuma habilidade necessária', text: 'Nada de planilha nem de formulário em branco. Você fotografa, o Tiroir preenche.' },
        { title: 'Seus dados são seus', text: 'Sem anúncios, nada é revendido nem usado para treinar modelos. Excluir sua conta apaga tudo, na hora.' },
        { title: 'Compartilhamento só para visualização', text: 'Um link para uma coleção: a pessoa vê, sem conta e sem app. Você desativa o link quando quiser.' },
      ],
      usesTitle: 'Também serve para…',
      uses: ['Montar a documentação do seguro', 'Fazer a mudança sem perder nada', 'Definir os preços de um bazar de garagem', 'Organizar o guarda-roupa'],
      why: 'Por que funciona: uma inteligência artificial de reconhecimento de imagem descreve cada foto. O resultado é só uma sugestão — cada campo pode ser editado, e suas correções sempre prevalecem.',
    },
    value: {
      eyebrow: 'O valor das suas coisas',
      title: 'Saiba quanto vale, e acompanhe.',
      sub: 'Uma estimativa baseada em anúncios parecidos, não um número tirado da cartola.',
      items: [
        { title: 'Estimar', text: 'Uma faixa de preço, e os anúncios que chegaram a ela.' },
        { title: 'Acompanhar', text: 'O valor de cada objeto e de cada coleção, atualizado quando você quiser.' },
        { title: 'Revender', text: 'Marque como “Vendido” com o preço real: o objeto continua no seu histórico.' },
      ],
      note: 'Não é uma avaliação profissional: para uma peça rara, é uma ordem de grandeza.',
      demo: { comparable: 'Anúncio parecido', sold: 'Vendido', trend: 'Valor da coleção' },
    },
    pricing: {
      eyebrow: 'Preços',
      title: 'Grátis para começar.',
      sub: 'Mude para um plano superior quando precisar.',
      perMonth: '/mês',
      perSeat: 'por usuário/mês',
      plans: {
        free: 'Objetos e coleções ilimitados, {n} análises por mês.',
        premium: 'Para acompanhar o valor da sua coleção.',
        pro: 'Para quem vive dos seus objetos.',
        business: 'Para gerenciar um estoque em equipe.',
      },
      note: 'Preços com impostos incluídos.',
      details: 'Ver os detalhes dos planos',
    },
    faq: {
      title: 'Perguntas frequentes',
      items: [
        { q: 'Preciso entender de tecnologia?', a: 'Não. Você tira uma foto, o Tiroir preenche a ficha. Tudo se corrige com um toque.' },
        { q: 'E se a ficha errar?', a: 'Cada campo pode ser editado, e suas correções sempre prevalecem. A marca exata ou o preço de compra, quem sabe é você.' },
        { q: 'Minhas fotos são privadas?', a: 'Sim. Nada fica público enquanto você não compartilhar um link, e você pode desativá-lo a qualquer momento.' },
        { q: 'A estimativa é confiável?', a: 'Ela se baseia em anúncios parecidos: um preço de partida confiável para um objeto comum, uma ordem de grandeza para uma peça rara.' },
      ],
    },
    final: {
      title: 'Seu primeiro objeto, guardado com uma foto.',
      sub: 'Grátis, sem cartão de crédito.',
    },
  },

  errors: {
    notFoundTitle: 'Página não encontrada',
    notFoundText: 'A página que você procura não existe ou foi movida.',
    serverTitle: 'Erro interno',
    serverText: 'Algo deu errado do nosso lado. Tente de novo daqui a pouco.',
    back: 'Voltar para o início',
  },
}

export default pt
