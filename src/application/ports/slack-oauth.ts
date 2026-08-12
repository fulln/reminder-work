import type { SlackDestinationCredential } from "./delivery-destination-repository";

export interface SlackOAuthPort {
  readonly available: boolean;
  authorizationUrl(input: {
    readonly state: string;
    readonly redirectUri: string;
  }): string;
  exchangeCode(input: {
    readonly code: string;
    readonly redirectUri: string;
  }): Promise<SlackDestinationCredential>;
  revoke(accessToken: string): Promise<void>;
}

export interface SlackOAuthStateRepository {
  issue(ownerUserId: string, now: Date): Promise<string>;
  consume(state: string, ownerUserId: string, now: Date): Promise<boolean>;
}
