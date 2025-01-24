import fastify from "fastify";

export const app = fastify({ logger: false });

app.setErrorHandler(function (error, request, reply) {
  console.log(error);
})