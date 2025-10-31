declare module '@nestjs/websockets' {
  export function WebSocketGateway(options?: any): ClassDecorator;
  export function WebSocketServer(): PropertyDecorator;
  export function SubscribeMessage(message: string): MethodDecorator;
  export function ConnectedSocket(): ParameterDecorator;
  export function MessageBody(): ParameterDecorator;

  export class WsException extends Error {
    constructor(message: string, error?: string);
  }

  export class BaseWsExceptionFilter {
    catch(exception: WsException, host: any): any;
  }

  export function OnGatewayConnection(): void;
  export function OnGatewayDisconnect(): void;
  export function OnGatewayInit(): void;
}