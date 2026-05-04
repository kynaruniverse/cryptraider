// ============================================================
// CRYPT RAIDER — ENGINE RUNTIME (SINGLE SOURCE OF TRUTH)
// ============================================================

export class EngineRuntime {
  constructor({
    input,
    systems,
    dispatcher,
    commandQueue,
    snapshotSystem,
    physics,
    context
  }) {
    this.input = input;
    this.systems = systems;
    this.dispatcher = dispatcher;
    this.commandQueue = commandQueue;
    this.snapshotSystem = snapshotSystem;
    this.physics = physics;
    this.context = context;
  }

  update(dt) {

    // ─────────────────────────────────────────────
    // 1. INPUT PHASE (pure intent capture)
    // ─────────────────────────────────────────────
    this.context.input = this.input;

    // ─────────────────────────────────────────────
    // 2. SYSTEMS PHASE (generate commands ONLY)
    // ─────────────────────────────────────────────
    for (const system of this.systems) {
      system.update(dt, this.context);
    }

    // ─────────────────────────────────────────────
    // 3. COMMAND EXECUTION PHASE (deterministic)
    // ─────────────────────────────────────────────
    const commands = this.commandQueue.drain();
    this.dispatcher.execute(commands);

    // ─────────────────────────────────────────────
    // 4. PHYSICS RESOLUTION PHASE
    // ─────────────────────────────────────────────
    this.physics.update(dt, this.context);

    // ─────────────────────────────────────────────
    // 5. SNAPSHOT / REPLAY PHASE
    // ─────────────────────────────────────────────
    this.snapshotSystem.capture(dt, this.context);
  }
}