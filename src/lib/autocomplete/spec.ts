import raw from './spec.json';

export type ValueDesc = string | BodyNode;
export interface BodyNode { [key: string]: ValueDesc }
export interface EndpointSpec { methods: string[]; bodyRef?: string }
export interface SpecData {
  endpoints: Record<string, EndpointSpec>;
  bodies: Record<string, BodyNode>;
}

export const spec: SpecData = raw as SpecData;

function refName(desc: string): string | undefined {
  if (desc.startsWith('[') && desc.endsWith(']')) desc = desc.slice(1, -1);
  if (desc.startsWith('#')) return desc.slice(1);
  return undefined;
}

export function validateSpec(s: SpecData): string[] {
  const errors: string[] = [];
  for (const [name, ep] of Object.entries(s.endpoints)) {
    if (ep.bodyRef && !s.bodies[ep.bodyRef]) errors.push(`endpoint ${name} -> #${ep.bodyRef}`);
  }
  const walk = (node: BodyNode, trail: string) => {
    for (const [key, desc] of Object.entries(node)) {
      if (typeof desc === 'object') { walk(desc, `${trail}.${key}`); continue; }
      const ref = refName(desc);
      if (ref && !s.bodies[ref]) errors.push(`${trail}.${key} -> #${ref}`);
    }
  };
  for (const [name, node] of Object.entries(s.bodies)) walk(node, name);
  return errors;
}
