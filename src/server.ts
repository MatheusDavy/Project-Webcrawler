import { app } from "./app";
import { InspectUrlUseCase } from "./use-cases/crawl/inspect-url";

app
  .listen({
    port: 9876,
  })
  .then(() => {
    new InspectUrlUseCase().execute()
    console.log("Server is running 🚀");
  })
  .catch(() => {
    process.exit();
  });
