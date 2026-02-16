import {
  NodeTracerProvider,
  BatchSpanProcessor,
} from '@opentelemetry/sdk-trace-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import {
  ATTR_SERVICE_NAME,
  ATTR_SERVICE_VERSION,
} from '@opentelemetry/semantic-conventions';
import { trace, context, Tracer, SpanStatusCode } from '@opentelemetry/api';
import type { TelemetryConfig } from '../types/index.js';

const PKG_VERSION = '0.1.0';

let provider: NodeTracerProvider | null = null;

/**
 * Initialize the OpenTelemetry tracer provider.
 *
 * Call once at application startup. Exports traces to a configured
 * OTel Collector via gRPC.
 */
export function initTracer(config: TelemetryConfig): Tracer {
  if (provider) {
    return trace.getTracer('agentguard', PKG_VERSION);
  }

  const resource = new Resource({
    [ATTR_SERVICE_NAME]: config.serviceName ?? 'agentguard-core',
    [ATTR_SERVICE_VERSION]: PKG_VERSION,
  });

  const exporter = new OTLPTraceExporter({
    url: config.endpoint,
  });

  provider = new NodeTracerProvider({
    resource,
    spanProcessors: [new BatchSpanProcessor(exporter)],
  });

  provider.register();

  return trace.getTracer('agentguard', PKG_VERSION);
}

/**
 * Get the AgentGuard tracer (must call initTracer first).
 */
export function getTracer(): Tracer {
  return trace.getTracer('agentguard', PKG_VERSION);
}

/**
 * Shut down the tracer provider gracefully.
 * Call during application shutdown to flush pending spans.
 */
export async function shutdownTracer(): Promise<void> {
  if (provider) {
    await provider.shutdown();
    provider = null;
  }
}

export { trace, context, SpanStatusCode };
