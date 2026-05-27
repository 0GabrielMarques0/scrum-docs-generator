import axios from 'axios';
import dotenv from 'dotenv';

// Ensure env vars are loaded
dotenv.config();

interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface AIResponse {
  choices: {
    message: {
      content: string;
    };
  }[];
}

interface ConsolidatedComponent {
  name: string;
  type: string;
  description: string;
  label?: string;
  placeholder?: string;
  required: boolean;
  validations: string[];
  relatedComponents: string[];
}

interface ScreenAnalysis {
  screenType: string;
  screenPurpose: string;
  consolidatedComponents: ConsolidatedComponent[];
  suggestedValidations: { field: string; rule: string; errorMessage: string }[];
  suggestedTestScenarios: { scenario: string; steps: string; expectedResult: string }[];
  apiIntegrations: { endpoint: string; method: string; trigger: string; payload: string; response: string }[];
  accessProfiles: string[];
  navigationFlow: { entry: string[]; exit: string[] };
}

export class AIService {
  private baseUrl: string;
  private model: string;

  constructor() {
    // GitHub Models API endpoint
    this.baseUrl = process.env.AI_API_URL || 'https://models.inference.ai.azure.com';
    this.model = process.env.AI_MODEL || 'gpt-4o';
  }

  /**
   * Get the GitHub token
   */
  private getToken(): string {
    return process.env.GITHUB_TOKEN || '';
  }

  /**
   * Check if AI service is configured
   */
  isConfigured(): boolean {
    const token = this.getToken();
    console.log('🔑 AI Token configured:', token ? `Yes (${token.substring(0, 15)}...)` : 'No');
    return !!token;
  }

  /**
   * Send a chat completion request
   */
  async chat(messages: AIMessage[], maxTokens: number = 4000): Promise<string> {
    const token = this.getToken();
    if (!token) {
      throw new Error('AI service not configured. Set GITHUB_TOKEN in .env');
    }

    try {
      const response = await axios.post<AIResponse>(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages,
          max_tokens: maxTokens,
          temperature: 0.3, // Lower temperature for more consistent outputs
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.choices[0]?.message?.content || '';
    } catch (error: any) {
      console.error('AI Service Error:', error.response?.data || error.message);
      throw new Error(`AI request failed: ${error.message}`);
    }
  }

  /**
   * Analyze a Figma screen and consolidate components intelligently
   */
  async analyzeScreen(screenName: string, components: any[], figmaUrl: string): Promise<ScreenAnalysis> {
    const systemPrompt = `Você é um analista de sistemas especializado em gerar requisitos funcionais a partir de telas de Figma.

Sua tarefa é analisar os componentes de uma tela e:
1. CONSOLIDAR componentes relacionados (ex: "input+label" + "E-mail" + "icon-mail" + "Type here..." = um único campo "E-mail")
2. IDENTIFICAR o tipo de tela (login, cadastro, listagem, formulário, dashboard, etc.)
3. GERAR validações específicas e relevantes
4. SUGERIR cenários de teste
5. IDENTIFICAR integrações de API necessárias

IMPORTANTE: 
- Agrupe componentes que fazem parte do mesmo elemento de UI
- Remova duplicatas e componentes decorativos irrelevantes
- Identifique campos obrigatórios baseado no contexto
- Gere nomes semânticos e descritivos para os componentes

Responda APENAS em JSON válido, sem markdown.`;

    const userPrompt = `Analise esta tela "${screenName}" do Figma (${figmaUrl}).

Componentes encontrados:
${JSON.stringify(components, null, 2)}

Retorne um JSON com esta estrutura:
{
  "screenType": "tipo da tela (login, cadastro, listagem, etc.)",
  "screenPurpose": "descrição do objetivo da tela em 1-2 frases",
  "consolidatedComponents": [
    {
      "name": "nome semântico do componente",
      "type": "input|button|checkbox|select|image|text|icon|link",
      "description": "descrição do componente e sua função",
      "label": "label do campo se aplicável",
      "placeholder": "placeholder se aplicável",
      "required": true/false,
      "validations": ["lista de validações necessárias"],
      "relatedComponents": ["nomes dos componentes originais que foram consolidados"]
    }
  ],
  "suggestedValidations": [
    {
      "field": "nome do campo",
      "rule": "regra de validação",
      "errorMessage": "mensagem de erro"
    }
  ],
  "suggestedTestScenarios": [
    {
      "scenario": "nome do cenário",
      "steps": "passos para executar",
      "expectedResult": "resultado esperado"
    }
  ],
  "apiIntegrations": [
    {
      "endpoint": "/api/endpoint",
      "method": "GET|POST|PUT|DELETE",
      "trigger": "quando é chamado",
      "payload": "dados enviados",
      "response": "resposta esperada"
    }
  ],
  "accessProfiles": ["perfis de acesso que podem ver esta tela"],
  "navigationFlow": {
    "entry": ["como chegar nesta tela"],
    "exit": ["para onde pode navegar"]
  }
}`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ]);

      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Invalid AI response format');
      }

      return JSON.parse(jsonMatch[0]) as ScreenAnalysis;
    } catch (error: any) {
      console.error('Error analyzing screen with AI:', error.message);
      // Return a fallback analysis
      return this.getFallbackAnalysis(screenName, components);
    }
  }

  /**
   * Generate enhanced requirements markdown using AI
   */
  async enhanceRequirements(requirements: any): Promise<string> {
    const systemPrompt = `Você é um analista de sistemas experiente que escreve documentação de requisitos clara e profissional.

Seu objetivo é melhorar a documentação de requisitos fornecida, tornando-a mais:
- Clara e específica
- Completa com detalhes relevantes
- Profissional e bem formatada
- Útil para desenvolvedores e QA

Mantenha o formato Markdown e adicione detalhes onde necessário.`;

    const userPrompt = `Melhore esta documentação de requisitos:

${JSON.stringify(requirements, null, 2)}

Retorne o documento completo em Markdown com:
1. Descrição detalhada do objetivo da tela
2. Componentes bem descritos com suas funções
3. Regras de validação específicas
4. Cenários de teste abrangentes
5. Fluxo de navegação claro`;

    try {
      const response = await this.chat([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ], 6000);

      return response;
    } catch (error: any) {
      console.error('Error enhancing requirements:', error.message);
      throw error;
    }
  }

  /**
   * Analyze a screen image using AI Vision and generate requirements
   */
  async analyzeScreenImage(
    screenName: string,
    base64Image: string,
    mimeType: string,
    projectName: string
  ): Promise<string> {
    const token = this.getToken();
    if (!token) {
      throw new Error('AI service not configured. Set GITHUB_TOKEN in .env');
    }

    const systemPrompt = `Você é um analista de sistemas sênior especializado em criar documentos de requisitos funcionais a partir de telas de sistemas.

Você gera documentos profissionais de requisitos no padrão de documentação técnica de software.
Seja objetivo, detalhado e use linguagem formal.

IMPORTANTE: Algumas imagens podem conter um quadro/box separado com "Rules" ou "Regras de negócio". 
Se identificar esse quadro, você DEVE extrair as regras escritas nele e classificá-las corretamente.

CLASSIFICAÇÃO OBRIGATÓRIA - Você DEVE separar corretamente:

**REQUISITOS FUNCIONAIS (RF)** - Descrevem O QUE o sistema FAZ (ações, comportamentos, funcionalidades):
- "O sistema deve validar as credenciais e iniciar uma sessão"
- "O formulário deve ter um botão para exibir/ocultar a senha"
- "O formulário deve ter um checkbox 'Remember me' para manter o usuário logado"
- "O formulário deve fornecer um link 'Forgot password' que direciona ao fluxo de recuperação"

**REGRAS DE NEGÓCIO (RN)** - Descrevem COMO os campos devem ser preenchidos, validações, restrições e mensagens:
- "O campo Email deve ser de preenchimento obrigatório"
- "O Email deve ser preenchido com um formato válido"
- "O Password deve conter no mínimo 8 caracteres com 1 maiúscula, 1 minúscula, 1 número e 1 especial"
- "Ao clicar em 'Log in' se o Email estiver em branco, exibir 'Invalid e-mail address'"`;

    const userPrompt = `Analise esta tela "${screenName}" do projeto "${projectName}" e gere um documento de requisitos funcionais em HTML.

PRIMEIRO: Verifique se há um quadro/box de "Rules" ou "Regras de negócio" na imagem. Se houver:
- Leia TODAS as regras escritas nesse quadro
- CLASSIFIQUE cada regra como Requisito Funcional OU Regra de Negócio conforme as definições abaixo

CLASSIFICAÇÃO:
- **Requisitos Funcionais**: Ações que o sistema EXECUTA (validar, exibir botão, fornecer link, iniciar sessão, direcionar usuário)
- **Regras de Negócio**: Validações de campos, formatos, obrigatoriedades, mensagens de erro

DEPOIS: Analise os elementos visuais da tela e gere requisitos adicionais.

O documento deve seguir EXATAMENTE este formato:

1. **Seção da Tela** com título "Tela de ${screenName}"

2. **Descrição Geral** - Um parágrafo breve explicando o propósito da tela

3. **Requisitos Funcionais** em tabela com colunas:
   - ID (RF-01, RF-02, etc.)
   - Requisito (nome curto)
   - Descrição (descrição detalhada do requisito)

4. **Requisitos Não Funcionais** em tabela com colunas:
   - ID (RNF-01, RNF-02, etc.)
   - Requisito (nome curto)
   - Descrição (descrição detalhada)

5. **Regras de Negócio** em TABELA com colunas:
   - ID (RN-01, RN-02, etc.)
   - Descrição (a regra completa)
   - Mensagem (mensagem de validação do sistema, se houver na regra. Se não houver, deixe "-")

   IMPORTANTE para a coluna Mensagem:
   - Extraia a mensagem que aparece entre aspas no final da regra
   - Exemplo: "Ao clicar em 'Log in' se o campo Email estiver em branco o sistema deve exibir a mensagem 'Invalid e-mail address'"
     → Descrição: "Ao clicar em 'Log in' se o campo Email estiver em branco o sistema deve exibir mensagem de validação"
     → Mensagem: "Invalid e-mail address"
   - Se a regra não tiver mensagem de sistema, coloque "-" na coluna Mensagem

IMPORTANTE:
- Use HTML bem formatado com estilos INLINE em cada elemento
- Fundo do body deve ser BRANCO (#ffffff)
- Tabelas devem ter style="table-layout: fixed; width: 100%; border-collapse: collapse;"
- CABEÇALHOS DE TABELA (th) DEVEM TER OBRIGATORIAMENTE: style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;"
- CÉLULAS DE TABELA (td) DEVEM TER: style="padding: 10px; border: 1px solid #e2e8f0;"
- ESTRUTURA DA TABELA DE RF OBRIGATÓRIA:
  <table style="table-layout: fixed; width: 100%; border-collapse: collapse;"><thead><tr><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">ID</th><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">Requisito</th><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">Descrição</th></tr></thead><tbody><tr><td style="padding: 10px; border: 1px solid #e2e8f0;">RF-01</td><td style="padding: 10px; border: 1px solid #e2e8f0;">Nome</td><td style="padding: 10px; border: 1px solid #e2e8f0;">Descrição</td></tr></tbody></table>
- ESTRUTURA DA TABELA DE RN OBRIGATÓRIA:
  <table style="table-layout: fixed; width: 100%; border-collapse: collapse;"><thead><tr><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">ID</th><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">Descrição</th><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">Mensagem</th></tr></thead><tbody><tr><td style="padding: 10px; border: 1px solid #e2e8f0;">RN-01</td><td style="padding: 10px; border: 1px solid #e2e8f0;">Descrição da regra</td><td style="padding: 10px; border: 1px solid #e2e8f0;">Mensagem ou -</td></tr></tbody></table>
- NUNCA coloque múltiplos headers numa única célula <th>
- Descrições devem ser CONCISAS (máximo 2 linhas)
- NÃO inclua cenários de teste, integrações/APIs ou histórico de revisões`;

    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { 
              role: 'user', 
              content: [
                { type: 'text', text: userPrompt },
                { 
                  type: 'image_url', 
                  image_url: { 
                    url: `data:${mimeType};base64,${base64Image}`,
                    detail: 'high'
                  } 
                }
              ]
            }
          ],
          max_tokens: 8000,
          temperature: 0.3,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0]?.message?.content || '';
      
      // Extract HTML if wrapped in code blocks
      const htmlMatch = content.match(/```html\n?([\s\S]*?)```/) || content.match(/<(!DOCTYPE|html|div|table|h1)/i);
      
      if (htmlMatch) {
        // If it's a code block, extract the content
        if (content.includes('```html')) {
          return content.replace(/```html\n?/g, '').replace(/```/g, '').trim();
        }
        return content;
      }
      
      // If not HTML, wrap in basic HTML structure
      return this.wrapInHTML(content, screenName, projectName);
    } catch (error: any) {
      console.error('AI Vision Error:', error.response?.data || error.message);
      throw new Error(`Erro ao analisar imagem: ${error.message}`);
    }
  }

  /**
   * Analyze multiple screen images using AI Vision and generate requirements
   * Images are processed in memory and not saved to disk
   */
  async analyzeMultipleScreenImages(
    screenName: string,
    images: { base64: string; mimeType: string }[],
    projectName: string
  ): Promise<string> {
    const token = this.getToken();
    if (!token) {
      throw new Error('AI service not configured. Set GITHUB_TOKEN in .env');
    }

    const systemPrompt = `Você é um analista de sistemas sênior especializado em criar documentos de requisitos funcionais a partir de telas de sistemas.

Você gera documentos profissionais de requisitos no padrão de documentação técnica de software.
Analise TODAS as imagens fornecidas como se fossem diferentes partes ou estados da mesma tela.
Seja objetivo, detalhado e use linguagem formal.

IMPORTANTE: Algumas imagens podem conter um quadro/box separado com "Rules" ou "Regras de negócio". 
Se identificar esse quadro em qualquer uma das imagens, você DEVE extrair as regras e classificá-las corretamente.

CLASSIFICAÇÃO OBRIGATÓRIA - Você DEVE separar corretamente:

**REQUISITOS FUNCIONAIS (RF)** - Descrevem O QUE o sistema FAZ (ações, comportamentos, funcionalidades):
- "O sistema deve validar as credenciais e iniciar uma sessão"
- "O formulário deve ter um botão para exibir/ocultar a senha"
- "O formulário deve ter um checkbox 'Remember me' para manter o usuário logado"
- "O formulário deve fornecer um link 'Forgot password' que direciona ao fluxo de recuperação"

**REGRAS DE NEGÓCIO (RN)** - Descrevem COMO os campos devem ser preenchidos, validações, restrições e mensagens:
- "O campo Email deve ser de preenchimento obrigatório"
- "O Email deve ser preenchido com um formato válido"
- "O Password deve conter no mínimo 8 caracteres com 1 maiúscula, 1 minúscula, 1 número e 1 especial"
- "Ao clicar em 'Log in' se o Email estiver em branco, exibir 'Invalid e-mail address'"`;

    const userPrompt = `Analise estas ${images.length} imagem(ns) da tela "${screenName}" do projeto "${projectName}" e gere um documento de requisitos funcionais em HTML.

PRIMEIRO: Verifique se há um quadro/box de "Rules" ou "Regras de negócio" em alguma das imagens. Se houver:
- Leia TODAS as regras escritas nesse quadro
- CLASSIFIQUE cada regra como Requisito Funcional OU Regra de Negócio conforme as definições abaixo

CLASSIFICAÇÃO:
- **Requisitos Funcionais**: Ações que o sistema EXECUTA (validar, exibir botão, fornecer link, iniciar sessão, direcionar usuário)
- **Regras de Negócio**: Validações de campos, formatos, obrigatoriedades, mensagens de erro

DEPOIS: Analise os elementos visuais da tela e gere requisitos adicionais.

O documento deve seguir EXATAMENTE este formato:

1. **Seção da Tela** com título "Tela de ${screenName}"

2. **Descrição Geral** - Um parágrafo breve explicando o propósito da tela

3. **Requisitos Funcionais** em tabela com colunas:
   - ID (RF-01, RF-02, etc.)
   - Requisito (nome curto)
   - Descrição (descrição detalhada do requisito)

4. **Requisitos Não Funcionais** em tabela com colunas:
   - ID (RNF-01, RNF-02, etc.)
   - Requisito (nome curto)
   - Descrição (descrição detalhada)

5. **Regras de Negócio** em TABELA com colunas:
   - ID (RN-01, RN-02, etc.)
   - Descrição (a regra completa)
   - Mensagem (mensagem de validação do sistema, se houver na regra. Se não houver, deixe "-")

   IMPORTANTE para a coluna Mensagem:
   - Extraia a mensagem que aparece entre aspas no final da regra
   - Exemplo: "Ao clicar em 'Log in' se o campo Email estiver em branco o sistema deve exibir a mensagem 'Invalid e-mail address'"
     → Descrição: "Ao clicar em 'Log in' se o campo Email estiver em branco o sistema deve exibir mensagem de validação"
     → Mensagem: "Invalid e-mail address"
   - Se a regra não tiver mensagem de sistema, coloque "-" na coluna Mensagem

IMPORTANTE:
- Use HTML bem formatado com estilos INLINE em cada elemento
- Fundo do body deve ser BRANCO (#ffffff)
- Tabelas devem ter style="table-layout: fixed; width: 100%; border-collapse: collapse;"
- CABEÇALHOS DE TABELA (th) DEVEM TER OBRIGATORIAMENTE: style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;"
- CÉLULAS DE TABELA (td) DEVEM TER: style="padding: 10px; border: 1px solid #e2e8f0;"
- ESTRUTURA DA TABELA DE RF OBRIGATÓRIA:
  <table style="table-layout: fixed; width: 100%; border-collapse: collapse;"><thead><tr><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">ID</th><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">Requisito</th><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">Descrição</th></tr></thead><tbody><tr><td style="padding: 10px; border: 1px solid #e2e8f0;">RF-01</td><td style="padding: 10px; border: 1px solid #e2e8f0;">Nome</td><td style="padding: 10px; border: 1px solid #e2e8f0;">Descrição</td></tr></tbody></table>
- ESTRUTURA DA TABELA DE RN OBRIGATÓRIA:
  <table style="table-layout: fixed; width: 100%; border-collapse: collapse;"><thead><tr><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">ID</th><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">Descrição</th><th style="background-color: #1e3a5f; color: white; padding: 12px; text-align: left; border: 1px solid #1e3a5f;">Mensagem</th></tr></thead><tbody><tr><td style="padding: 10px; border: 1px solid #e2e8f0;">RN-01</td><td style="padding: 10px; border: 1px solid #e2e8f0;">Descrição da regra</td><td style="padding: 10px; border: 1px solid #e2e8f0;">Mensagem ou -</td></tr></tbody></table>
- NUNCA coloque múltiplos headers numa única célula <th>
- Descrições devem ser CONCISAS (máximo 2 linhas)
- NÃO inclua cenários de teste, integrações/APIs ou histórico de revisões`;

    try {
      // Build content array with text and all images
      const contentArray: any[] = [{ type: 'text', text: userPrompt }];
      
      for (const img of images) {
        contentArray.push({
          type: 'image_url',
          image_url: {
            url: `data:${img.mimeType};base64,${img.base64}`,
            detail: 'high'
          }
        });
      }

      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contentArray }
          ],
          max_tokens: 8000,
          temperature: 0.3,
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const content = response.data.choices[0]?.message?.content || '';
      
      // Extract HTML if wrapped in code blocks
      const htmlMatch = content.match(/```html\n?([\s\S]*?)```/) || content.match(/<(!DOCTYPE|html|div|table|h1)/i);
      
      if (htmlMatch) {
        if (content.includes('```html')) {
          return content.replace(/```html\n?/g, '').replace(/```/g, '').trim();
        }
        return content;
      }
      
      return this.wrapInHTML(content, screenName, projectName);
    } catch (error: any) {
      console.error('AI Vision Error:', error.response?.data || error.message);
      throw new Error(`Erro ao analisar imagens: ${error.message}`);
    }
  }

  /**
   * Wrap plain text in HTML structure
   */
  private wrapInHTML(content: string, screenName: string, projectName: string): string {
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: 'Segoe UI', sans-serif; line-height: 1.6; color: #333; padding: 20px; max-width: 900px; margin: 0 auto; background-color: #ffffff; }
    h1 { color: #1e3a5f; border-bottom: 2px solid #1e3a5f; padding-bottom: 10px; }
    h2 { color: #1e3a5f; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-top: 30px; }
    h3 { color: #2c5282; }
    table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    th { background: #1e3a5f; color: white; padding: 12px; text-align: left; }
    td { padding: 10px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) { background: #f8fafc; }
    .header { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .section { margin-bottom: 25px; }
    pre { background: #f1f5f9; padding: 15px; border-radius: 5px; overflow-x: auto; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${projectName} - ${screenName}</h1>
    <p><strong>Data:</strong> ${new Date().toLocaleDateString('pt-BR')}</p>
    <p><strong>Versão:</strong> 1.0</p>
  </div>
  
  <div class="section">
    ${content.replace(/\n/g, '<br>')}
  </div>
</body>
</html>`;
  }

  /**
   * Fallback analysis when AI is not available
   */
  private getFallbackAnalysis(screenName: string, components: any[]): ScreenAnalysis {
    const screenNameLower = screenName.toLowerCase();
    
    // Detect screen type
    let screenType = 'formulário';
    let screenPurpose = 'Tela de formulário genérico';
    
    if (screenNameLower.includes('login')) {
      screenType = 'login';
      screenPurpose = 'Tela de autenticação de usuários no sistema';
    } else if (screenNameLower.includes('cadastro') || screenNameLower.includes('register')) {
      screenType = 'cadastro';
      screenPurpose = 'Tela de registro de novos usuários';
    } else if (screenNameLower.includes('lista') || screenNameLower.includes('list')) {
      screenType = 'listagem';
      screenPurpose = 'Tela de visualização e gerenciamento de itens';
    } else if (screenNameLower.includes('dashboard') || screenNameLower.includes('home')) {
      screenType = 'dashboard';
      screenPurpose = 'Tela principal com resumo de informações';
    }

    // Basic component consolidation
    const consolidatedComponents: ConsolidatedComponent[] = [];
    const processedNames = new Set<string>();

    for (const comp of components) {
      const nameLower = (comp.name || '').toLowerCase();
      
      // Skip decorative/duplicate components
      if (processedNames.has(nameLower)) continue;
      if (['type here...', 'digite aqui', 'icon-', 'tabler'].some(skip => nameLower.includes(skip))) continue;
      
      processedNames.add(nameLower);
      
      consolidatedComponents.push({
        name: comp.name,
        type: comp.type || 'unknown',
        description: `Componente ${comp.type} da interface`,
        label: comp.label,
        placeholder: comp.placeholder,
        required: comp.required || false,
        validations: [],
        relatedComponents: [],
      });
    }

    return {
      screenType,
      screenPurpose,
      consolidatedComponents,
      suggestedValidations: [],
      suggestedTestScenarios: [
        { scenario: 'Fluxo feliz', steps: 'Preencher todos os campos e submeter', expectedResult: 'Operação concluída' },
        { scenario: 'Erro de validação', steps: 'Submeter com campos inválidos', expectedResult: 'Exibir mensagens de erro' },
      ],
      apiIntegrations: [],
      accessProfiles: ['Usuário autenticado'],
      navigationFlow: {
        entry: ['Menu principal', 'Link direto'],
        exit: ['Tela seguinte', 'Voltar'],
      },
    };
  }
}

export const aiService = new AIService();
