let ENTITY_ID = 1;

export class ECSWorld {
  constructor() {
    this.archetypes = new Map();
    this.entityMap = new Map();
  }

  createEntity() {
    return ENTITY_ID++;
  }

  destroyEntity(id) {
    const arch = this.entityMap.get(id);
    if (!arch) return;
    arch.remove(id);
    this.entityMap.delete(id);
  }

  _signature(components) {
    return components.sort().join('|');
  }

  _getArch(sig) {
    if (!this.archetypes.has(sig)) {
      this.archetypes.set(sig, new Archetype(sig));
    }
    return this.archetypes.get(sig);
  }

  addEntity(id, components, data) {
    const sig = this._signature(components);
    const arch = this._getArch(sig);

    arch.add(id, data);
    this.entityMap.set(id, arch);
  }

  query(components) {
    const sig = this._signature(components);
    const arch = this.archetypes.get(sig);
    if (!arch) return [];

    return arch.ids.map((id, i) => ({
      id,
      index: i,
      data: arch
    }));
  }
}

class Archetype {
  constructor(signature) {
    this.signature = signature;
    this.ids = [];
    this.columns = new Map();
  }

  ensure(key) {
    if (!this.columns.has(key)) {
      this.columns.set(key, []);
    }
    return this.columns.get(key);
  }

  add(id, data) {
    const index = this.ids.length;
    this.ids.push(id);

    for (const k in data) {
      const col = this.ensure(k);
      col[index] = data[k];
    }
  }

  remove(id) {
    const i = this.ids.indexOf(id);
    if (i === -1) return;

    const last = this.ids.length - 1;

    this.ids[i] = this.ids[last];
    this.ids.pop();

    for (const col of this.columns.values()) {
      col[i] = col[last];
      col.pop();
    }
  }
}