import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import spec from '../openapi.json';

export default function ApiDocs() {
  return <SwaggerUI spec={spec} />;
}
