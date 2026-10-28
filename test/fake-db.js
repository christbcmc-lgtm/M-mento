// Firestore en mémoire, minimal, pour les tests node --test (aucun réseau).
// Couvre exactement ce qu'utilise le noyau d'accès : collection/doc/get/set/update/
// delete, sous-collections, collection.get() (listage) et runTransaction.
function makeDb() {
  const docs = new Map(); // chemin complet -> objet de données

  class Col {
    constructor(path) { this.path = path; }
    doc(id) {
      if (!id) id = 'auto_' + Math.random().toString(36).slice(2, 12);
      return new Doc(this.path + '/' + id);
    }
    async get() {
      const prefix = this.path + '/';
      const out = [];
      for (const [k, v] of docs) {
        if (k.startsWith(prefix)) {
          const rest = k.slice(prefix.length);
          if (!rest.includes('/')) out.push({ id: rest, data: () => v });
        }
      }
      return { size: out.length, docs: out, forEach: (f) => out.forEach(f) };
    }
  }
  class Doc {
    constructor(path) { this.path = path; const p = path.split('/'); this.id = p[p.length - 1]; }
    collection(name) { return new Col(this.path + '/' + name); }
    async get() { const v = docs.get(this.path); return { exists: v !== undefined, id: this.id, data: () => v }; }
    async set(obj, opts) {
      if (opts && opts.merge && docs.has(this.path)) docs.set(this.path, Object.assign({}, docs.get(this.path), obj));
      else docs.set(this.path, Object.assign({}, obj));
    }
    async update(obj) {
      if (!docs.has(this.path)) throw new Error('document inexistant: ' + this.path);
      docs.set(this.path, Object.assign({}, docs.get(this.path), obj));
    }
    async delete() { docs.delete(this.path); }
  }
  async function runTransaction(fn) {
    const tx = {
      get: (ref) => ref.get(),
      set: (ref, obj, opts) => { ref.set(obj, opts); },
      update: (ref, obj) => { ref.update(obj); },
      delete: (ref) => { ref.delete(); }
    };
    return await fn(tx);
  }
  return { collection: (p) => new Col(p), runTransaction, __docs: docs };
}
module.exports = { makeDb };
