import { chromium, Page, Browser } from "@playwright/test";
import fs from "fs";

const FILE_ACCESSED_URLS = "./data/zattini/visitedUrls.json";
const FILE_VISITING_URLS = "./data/zattini/visitingUrls.json";
const JSON_FILE = './data/zattini/questions.json';

const BASE_URL = "https://www.zattini.com.br/";

const MAIN_CONTENT_GROUP = ".question-and-answers";
const MAIN_QUESTION_CLASS = ".item__question";
const MAIN_RESPONSE_CLASS = ".item__answer";

const MORE_CONTENT_GROUP = ".questions__modal .item";
const MORE_QUESTION_CLASS = ".item__question";
const MORE_RESPONSE_CLASS = ".item__answer__text";

const CATEGORY_CLASS = ".breadcrumb__name";
const PRODUCT_TITLE = "h1.product-name";
const BTN_SEE_MORE = ".questions__btn-see-all";

const urlsBlocked: string[] = [
  '/cartao-netshoes',
  '/auth/login',
  '/institucional/acessibilidade',
  '/mobile-app-zattini',
  '/wishlist',
  '/login',
  '/account/',
  '/cart',
];

type QuestionResponse = {
  question: string;
  response: string;
};

type SaveContentProps = {
  questions: QuestionResponse[];
  product: string;
  category: string;
  subcategory: string;
};

export class InspectZattiniUseCase {
  visitedUrls: any;
  visitingUrls: any;

  constructor() {
    this.visitedUrls = this.loadUrlsFromFile(FILE_ACCESSED_URLS);
    this.visitingUrls = this.loadUrlsFromFile(FILE_VISITING_URLS, false);
  }

  async execute(): Promise<void> {
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
        console.log(`Acessando: ${url}`);
  
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
      const category: string | null = await categoryElem[1].textContent();
      return category?.trim().substring(0, 100) || "";
    }
    return "";
  }

  async getSubcategory(page: Page): Promise<string> {
    const categoryElem = await page.$$(CATEGORY_CLASS).catch(() => []);
    if (categoryElem.length > 0) {
      const category: string | null = await categoryElem[2].textContent();
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

    const seeMoreButton = await page.$(BTN_SEE_MORE);
    if (seeMoreButton) {
      await seeMoreButton.click();
      await page.waitForSelector(MORE_CONTENT_GROUP, { timeout: 2000 }).catch(() => {});
      const moreQuestions = await this.getMoreQuestions(page);    
      data.push(...moreQuestions);
    }

    return data;
  }

  async getMoreQuestions(page: Page): Promise<QuestionResponse[]>{
    const data: QuestionResponse[] = [];

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
    console.log(`Conteúdo salvo em ${JSON_FILE}`);
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
