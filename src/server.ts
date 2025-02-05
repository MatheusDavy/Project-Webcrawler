import { app } from "./app";
import { InspectMercadoLivreUseCase } from "./use-cases/crawl/inspect-mercado-livre";
import { InspectZattiniUseCase } from "./use-cases/crawl/inspect-zattini";

app
  .listen({
    port: 9876,
  })
  .then(() => {
    console.log("Server is running 🚀");
    new InspectMercadoLivreUseCase().execute()
    new InspectZattiniUseCase().execute();
  })
  .catch(() => {
    process.exit();
  });
