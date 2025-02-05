import { chromium, Page, Browser } from "@playwright/test";
import fs from "fs";

const FILE_ACCESSED_URLS = "./data/mercado-livre/visitedUrls.json";
const FILE_VISITING_URLS = "./data/mercado-livre/visitingUrls.json";
const JSON_FILE = './data/mercado-livre/questions.json';

const BASE_URL = "https://www.mercadolivre.com.br/";

const MAIN_CONTENT_GROUP = ".ui-pdp-qadb__questions-list__question";
const MAIN_QUESTION_CLASS = ".ui-pdp-qadb__questions-list__question__label";
const MAIN_RESPONSE_CLASS = ".ui-pdp-qadb__questions-list__answer-item__answer";

const MORE_CONTENT_IFRAME = "iframe.ui-pdp-qadb__questions-list";
const MORE_CONTENT_GROUP = ".ui-pdp-questions__questions-list__item-questions--others-questions";
const MORE_QUESTION_CLASS = ".ui-pdp-questions__questions-list__question";
const MORE_RESPONSE_CLASS = ".ui-pdp-questions__questions-list__container-answer__isNoCollapsed span";

const CATEGORY_CLASS = ".andes-breadcrumb__link";
const PRODUCT_TITLE = ".ui-pdp-title";
const BTN_SEE_MORE = ".ui-pdp-action-modal__link";

const urlsBlocked: string[] = [
  "/c/",
  "=cetegories",
  "/categorias",
  "/ofertas",
  "/cupons",
  "play.mercadolivre",
  "ajuda",
  "registration",
  "/jms/mlb/lgz/",
  "/gz/cart/",
  "/acessibilidade/feedback",
  "lista.mercadolivre",
  "/assinaturas/",
  "#root-app",
  "/navigation/addresses",
  "/veiculos/",
  "/imoveis/",
  "/importados/",
  "/produtos-sustentaveis",
  "/lojas-oficiais",
  "/syi/core/",
  "/compra-garantida/",
  '/A/1',
  '/B/1',
  '/C/1',
  '/D/1',
  '/E/1',
  '/F/1',
  '/G/1',
  '/H/1',
  '/I/1',
  '/J/1',
  '/K/1',
  '/L/1',
  '/M/1',
  '/N/1',
  '/O/1',
  '/P/1',
  '/Q/1',
  '/R/1',
  '/S/1',
  '/T/1',
  '/U/1',
  '/V/1',
  '/W/1',
  '/X/1',
  '/Y/1',
  '/Z/1',
  '/blog/'
];

type QuestionResponse = {
  question: string;
  response: string;
};

type SaveContentProps = {
  questions: QuestionResponse[];
  product: string;
  category: string;
  subcategory: string
};

export class InspectMercadoLivreUseCase {
  visitedUrls: any;
  visitingUrls: any;

  constructor() {
    this.visitedUrls = this.loadUrlsFromFile(FILE_ACCESSED_URLS);
    this.visitingUrls = this.loadUrlsFromFile(FILE_VISITING_URLS, false);
  }

  async execute(): Promise<void> {
    console.log("Iniciando busca mercado livre.");
    try {
      const browser: Browser = await chromium.launch({ headless: false, channel: "chrome" });
      const page: Page = await browser.newPage();
  
      // Adiciona a página inicial para início
      if (!this.visitingUrls.includes(BASE_URL) && !this.visitedUrls.has(BASE_URL)) {
        this.visitingUrls.push(BASE_URL);
      }
  
      while (this.visitingUrls.length > 0) {
        const url = this.visitingUrls.shift();
        if (!url) continue;
  
        if (this.visitedUrls.has(url)) continue;
  
        this.visitedUrls.add(url);
  
        const extractedUrls: string[] = await this.checkContent(page, url);
        const filteredUrls: string[] = extractedUrls.filter(
          (url) =>
            !urlsBlocked.some((blocked) => url.includes(blocked)) &&
            !this.visitingUrls.includes(url) &&
            !this.visitedUrls.has(url)
        );
  
        this.visitingUrls.push(...filteredUrls);
  
        this.saveUrlsToFile(FILE_ACCESSED_URLS, [...this.visitedUrls]);
        this.saveUrlsToFile(FILE_VISITING_URLS, this.visitingUrls);
  
        const delay = Math.random() * (15000 - 10000) + 10000;
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
  
      await browser.close();
      console.log("Processo finalizado.");
    } catch (err) {
      await this.execute();
    }
  }

  async checkContent(page: Page, url: string): Promise<string[]> {
    try {
      await page.goto(url, { waitUntil: "load" });

      const category: string = await this.getCategory(page);
      const product: string = await this.getProductName(page);
      const subcategory: string = await this.getSubcategory(page);

      const hasQuestions = await page.$(MAIN_CONTENT_GROUP);
      if (hasQuestions) {
        const questions: QuestionResponse[] = await this.getQuestions(page);
        await this.saveContent({ questions, product, category, subcategory });
      }

      return page
        .$$eval("a", (anchors: HTMLAnchorElement[]) =>
          anchors
            .map((a) => a.href)
            .filter((href) => href.startsWith(window.location.origin))
        )
        .catch(() => []);
    } catch (error) {
      console.error(`Erro ao acessar ${url}:`, error);
      return [];
    }
  }

  async getCategory(page: Page): Promise<string> {
    const categoryElem = await page.$$(CATEGORY_CLASS).catch(() => []);
    if (categoryElem.length > 0) {
      const category: string | null = await categoryElem[0].getAttribute("title");
      return category?.trim().substring(0, 100) || "";
    }
    return "";
  }

  async getSubcategory(page: Page): Promise<string> {
    const categoryElem = await page.$$(CATEGORY_CLASS).catch(() => []);
    if (categoryElem.length > 0) {
      const category: string | null = await categoryElem[1].getAttribute("title");
      return category?.trim().substring(0, 100) || "";
    }
    return "";
  }

  async getProductName(page: Page): Promise<string> {
    const nameElem = await page.$$(PRODUCT_TITLE).catch(() => []);
    if (nameElem.length > 0) {
      const name: string | null = await nameElem[0].textContent();
      return name?.trim().substring(0, 100) || "";
    }
    return "";
  }

  async getQuestions(page: Page): Promise<QuestionResponse[]> {
    const data: QuestionResponse[] = [];
    await page.waitForSelector(MAIN_CONTENT_GROUP, { timeout: 5000 }).catch(() => {});

    const groups = await page.$$(MAIN_CONTENT_GROUP).catch(() => []);
    for (const group of groups) {
      const questionElem = await group.$(MAIN_QUESTION_CLASS);
      const responseElem = await group.$(MAIN_RESPONSE_CLASS);

      const question: string = questionElem ? (await questionElem.textContent())?.trim() || "" : "";
      const response: string = responseElem ? (await responseElem.textContent())?.trim() || "" : "";

      if (question && response) {
        data.push({ question, response });
      }
    }

    const btnSeeMore = await page.$$(BTN_SEE_MORE).catch(() => []);
    
    if (btnSeeMore.length > 0) {
      for (const btn of btnSeeMore) {
        const isButtonToSeeMoreQuestions = await btn.textContent();
        if (isButtonToSeeMoreQuestions?.trim() === "Ver todas as perguntas") {
          await btn.click();
          await page.waitForSelector(MORE_CONTENT_IFRAME, { timeout: 2000 }).catch(() => {});
          const iframes = await page.$$(MORE_CONTENT_IFRAME).catch(() => []);
          for (const iframe of iframes) {
            const src = await iframe.getProperty('src').then((prop) => prop.jsonValue());
            if (src.includes('/noindex/questions/')){
              const moreQuestions = await this.getMoreQuestions(page, src);        
              data.push(...moreQuestions);
              break;
            }
          }

          break;
        }
      }
    }

    return data;
  }

  async getMoreQuestions(page: Page, url: string): Promise<QuestionResponse[]>{
    const data: QuestionResponse[] = [];

    await page.goto(url, { waitUntil: "load" });
    await page.waitForSelector(MORE_CONTENT_GROUP, { timeout: 5000 }).catch(() => {});

    const groups = await page.$$(MORE_CONTENT_GROUP).catch(() => []);
    for (const group of groups) {
      const questionElem = await group.$(MORE_QUESTION_CLASS);
      const responseElem = await group.$(MORE_RESPONSE_CLASS);

      const question: string = questionElem ? (await questionElem.textContent())?.trim() || "" : "";
      const response: string = responseElem ? (await responseElem.textContent())?.trim() || "" : "";

      if (question && response) {
        data.push({ question, response });
      }
    }

    return data;
  }

  async saveContent(props: SaveContentProps): Promise<void> {
    let existingData: any[] = [];

    if (fs.existsSync(JSON_FILE)) {
      const fileData = fs.readFileSync(JSON_FILE, 'utf-8');
      existingData = JSON.parse(fileData);
    }

    props.questions.forEach(({ question, response }) => {
      existingData.push({
        product: props.product,
        category: props.category,
        subcategory: props.subcategory,
        question,
        response,
      });
    });

    fs.writeFileSync(JSON_FILE, JSON.stringify(existingData, null, 2), 'utf-8');
  }

  loadUrlsFromFile(filePath: string, asSet = true): Set<string> | string[] {
    if (fs.existsSync(filePath)) {
      const content = JSON.parse(fs.readFileSync(filePath, "utf-8")) as string[];
      return asSet ? new Set(content) : content;
    }
    return asSet ? new Set() : [];
  }

  saveUrlsToFile(filePath: string, urls: string[]): void {
    fs.writeFileSync(filePath, JSON.stringify(urls, null, 2));
  }
}
