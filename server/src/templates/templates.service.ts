import * as YAML from 'yaml';
import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { assertSafeUrl, safeAxiosOptions } from '../common/utils/ssrf.util';

@Injectable()
export class TemplatesService {
  private YAML = YAML;
  constructor() {}

  async getTemplate(templateB64: string) {
    // decode the base64 encoded URL
    const templateUrl = Buffer.from(templateB64, 'base64').toString('ascii');

    // La URL viene del usuario: sin esto el server pedía cualquier dirección,
    // incluidas las internas (SSRF). Ver common/utils/ssrf.util.ts
    assertSafeUrl(templateUrl);

    const template = await axios
      .get(templateUrl, safeAxiosOptions())
      .catch((err) => {
        throw new Error(err);
      });
    if (template) {
      const ret = this.YAML.parse(template.data);
      return ret.spec;
    }
  }
}
