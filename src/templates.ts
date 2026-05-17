export interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  body: string;
  category: string;
}

export const EMAIL_TEMPLATES: EmailTemplate[] = [
  // ... (manter os anteriores ou substituir? Vou adicionar para expandir a biblioteca)
  {
    id: 'ads-audit',
    name: 'Auditoria de Tráfego Ads',
    subject: 'Notei algo no seu anúncio do Google/Meta... 🧐',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="padding: 30px; border: 1px solid #e5e7eb; border-radius: 12px;">
    <p>Olá, {{name}}!</p>
    <p>Estava navegando e vi um anúncio da <b>{{company}}</b>. Como especialista em tráfego pago, não pude deixar de notar um detalhe técnico que pode estar fazendo você "rasgar" parte do seu orçamento diário.</p>
    <p>Fiz uma análise rápida e identifiquei 3 pontos onde você poderia baixar seu CAC (Custo de Aquisição) imediatamente.</p>
    <p><b>Posso te enviar um print dessa análise ou marcamos 5 minutos para eu te mostrar?</b></p>
    <p>Sem compromisso nenhum, só para ajudar um negócio da nossa região.</p>
    <p>Abraços,<br><b>[Seu Nome] | Zima Marketing</b></p>
  </div>
</div>
    `.trim()
  },
  {
    id: 'seo-visibility',
    name: 'Visibilidade SEO',
    subject: 'Seus concorrentes estão ficando com seus cliques (Análise SEO) 📈',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; background-color: #f9fafb; padding: 20px;">
  <div style="background-color: white; padding: 30px; border-radius: 16px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
    <p>Olá, {{name}}!</p>
    <p>Acabei de rodar um relatório de visibilidade orgânica para o termo "<b>[Palavra-Chave]</b>" e vi que a {{company}} aparece abaixo da [Concorrente X].</p>
    <p>Isso significa que cerca de <b>70% do tráfego qualificado</b> está indo para eles antes mesmo de conhecerem sua solução.</p>
    <p>Eu desenhei um plano de 3 etapas para vocês inverterem esse jogo no próximo trimestre. Você teria 10 minutos na quarta-feira para conversarmos sobre isso?</p>
    <p>Atenciosamente,<br><b>[Seu Nome]</b></p>
  </div>
</div>
    `.trim()
  },
  {
    id: 'ecommerce-roas',
    name: 'E-commerce: Escala de Vendas',
    subject: 'Como a {{company}} pode atingir um ROAS de 10x ainda este mês 💰',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <div style="background: linear-gradient(135deg, #059669 0%, #10b981 100%); padding: 30px; border-radius: 16px 16px 0 0; text-align: center;">
    <h2 style="color: white; margin: 0;">Foco em Faturamento</h2>
  </div>
  <div style="padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 16px 16px;">
    <p>Olá, {{name}}!</p>
    <p>Vi que o mix de produtos da {{company}} é incrível, mas percebi que vocês não estão usando <b>Remarketing Dinâmico</b> da forma mais agressiva possível.</p>
    <p>Recentemente ajudamos um e-commerce do mesmo ticket médio a subir o faturamento em 45% apenas ajustando a segmentação do catálogo.</p>
    <p>Quero te mostrar como aplicar isso na sua loja. Você topa uma breve call de estratégia?</p>
    <div style="text-align: center; margin-top: 20px;">
      <a href="#" style="color: #059669; font-weight: bold; text-decoration: underline;">Agendar Consultoria Grátis</a>
    </div>
  </div>
</div>
    `.trim()
  },
  {
    id: 'local-business',
    name: 'Negócios Locais (Google Maps)',
    subject: 'Notei que a {{company}} não é a #1 no Google Maps da região 📍',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 25px; border-left: 5px solid #ef4444; background: #fff5f5;">
  <p>Oi, {{name}}, tudo bem?</p>
  <p>Estava procurando por "<b>[Seu Serviço/Categoria]</b>" aqui perto e percebi que o perfil da {{company}} no Google tem poucas fotos recentes e avaliações sem resposta.</p>
  <p>Hoje, <b>82% das pessoas</b> decidem onde ir pelo Google Maps. Vocês estão perdendo clientes para empresas que têm um perfil pior, mas mais otimizado.</p>
  <p>Sou especialista em SEO Local e posso colocar vocês no topo em menos de 30 dias.</p>
  <p>Posso te ligar amanhã às 14h para te explicar como funciona?</p>
  <p>Abs,<br><b>[Seu Nome]</b></p>
</div>
    `.trim()
  },
  {
    id: 'video-pitch',
    name: 'Vídeo Personalizado (Intro)',
    subject: 'Gravei um vídeo curto para você, {{name}}... ▶️',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; text-align: center;">
  <p style="text-align: left;">Olá, {{name}}!</p>
  <p style="text-align: left;">Em vez de mandar um texto gigante, prefiro te mostrar visualmente o que vi no seu site/processo de vendas.</p>
  <div style="margin: 25px 0; background-color: #000; border-radius: 12px; padding: 40px; position: relative; cursor: pointer;">
    <span style="color: white; font-size: 50px;">▶️</span>
    <p style="color: white; margin-top: 10px; font-weight: bold;">Análise_Estratégica_{{company}}.mp4</p>
  </div>
  <p style="font-size: 14px; color: #666;">(Clique acima para ver a análise que preparei para vocês)</p>
  <p style="text-align: left; margin-top: 30px;">Assiste aí e me diz o que achou. Acredito que temos uma sinergia gigante.</p>
  <p style="text-align: left;">Abs,<br><b>[Seu Nome]</b></p>
</div>
    `.trim()
  },
  {
    id: 'content-strategy',
    name: 'Estratégia de Conteúdo/Reels',
    subject: 'O Instagram da {{company}} tem uma "mina de ouro" escondida... 💎',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 30px; border-radius: 24px; border: 2px solid #a855f7;">
  <p>Olá, {{name}}!</p>
  <p>Sou fã da marca {{company}}, mas notei que vocês estão postando muito conteúdo de "venda direta" e pouco conteúdo que gera retenção e desejo.</p>
  <p>Mapeei 5 temas de Reels que estão viralizando no seu nicho agora e que vocês poderiam gravar em menos de 1 hora para atrair milhares de novos seguidores qualificados.</p>
  <p><b>Quer que eu te mande essa lista de temas?</b></p>
  <p>Me avisa se tiver interesse!</p>
  <p>Abraços,<br><b>[Seu Nome] | Social Media Estrategista</b></p>
</div>
    `.trim()
  },
  {
    id: 'case-study-focus',
    name: 'Prova Social / Estudo de Caso',
    subject: 'Como geramos 150 novos leads para uma empresa como a sua 🚀',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <p>Olá, {{name}}!</p>
  <p>Trabalho com agências/empresas do setor de <b>[Nicho]</b> e recentemente tivemos um resultado fora da curva que me lembrou muito o potencial da {{company}}.</p>
  <p>Saímos de 0 a 150 leads qualificados por mês em 60 dias usando uma técnica de <b>[Sua Técnica]</b>.</p>
  <p>Gostaria de compartilhar os bastidores dessa campanha com você. Pode servir de inspiração para o seu crescimento este ano.</p>
  <p>Você tem disponibilidade para um bate-papo rápido de 15 min?</p>
  <p>Aguardo seu retorno!</p>
</div>
    `.trim()
  },
  {
    id: 'quick-strategy-call',
    name: 'Convite para Estratégia',
    subject: 'Pergunta rápida sobre o crescimento da {{company}} em 2024 📈',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; background: #f3f4f6; padding: 40px;">
  <div style="background: white; padding: 30px; border-radius: 8px;">
    <p>Oi, {{name}}!</p>
    <p>Estou montando o planejamento estratégico de alguns novos clientes e me sobraram 2 vagas para consultoria focada em <b>Escala de Vendas</b>.</p>
    <p>Pela minha análise, a {{company}} tem o perfil exato do que buscamos: produto sólido, mas com um marketing que ainda pode ser muito mais agressivo.</p>
    <p>Topa conversarmos sobre como transformar seu marketing em uma máquina de vendas?</p>
    <p>Se não for o momento, tudo bem! Mas se for, me avisa que te mando meu Calendly.</p>
  </div>
</div>
    `.trim()
  },
  {
    id: 'prospecting-followup',
    name: 'Follow-up (O "Pulinho")',
    subject: 'Re: Notei algo no seu anúncio do Google... 🆙',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <p>Olá, {{name}}!</p>
  <p>Imagino que sua rotina esteja corrida, então estou passando apenas para dar um "pulinho" no topo da sua caixa de entrada.</p>
  <p>Gostaria muito de te mostrar aqueles 3 pontos de melhoria que identifiquei na {{company}}. Acredito realmente que podemos baixar seu custo por clique consideravelmente.</p>
  <p><b>Consegue falar rapidinho amanhã ou na sexta?</b></p>
  <p>Abs,<br><b>[Seu Nome]</b></p>
</div>
    `.trim()
  },
  {
    id: 'breakup-email',
    name: 'Despedida (Breakup)',
    subject: 'Devo tirar o seu nome da lista? 🚪',
    category: 'Prospecção',
    body: `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333; padding: 30px;">
  <p>Olá, {{name}}!</p>
  <p>Te enviei algumas mensagens sobre como podemos ajudar a {{company}} a crescer com marketing digital, mas não tivemos retorno.</p>
  <p>Entendo perfeitamente que as prioridades mudam. Geralmente, quando não recebo resposta, é por um destes dois motivos:</p>
  <ol>
    <li>Marketing e Vendas não são sua prioridade número 1 no momento.</li>
    <li>Você está ocupado demais e ainda não conseguiu parar para ver.</li>
  </ol>
  <p>Se for o caso #1, este é meu último e-mail e não vou mais ocupar seu tempo. Se for o #2, quando seria um bom momento para conversarmos?</p>
  <p>Desejo muito sucesso à {{company}}!</p>
  <p>Abraços,<br><b>[Seu Nome]</b></p>
</div>
    `.trim()
  }
];

