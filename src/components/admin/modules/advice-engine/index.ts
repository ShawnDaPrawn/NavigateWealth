/**
 * advice-engine module — public API.
 *
 * Pure re-export barrel: the module component lives in AdviceEngineModule.tsx.
 * Everything other modules and outside code may use is named here, so the
 * module's internals stay private (see .dependency-cruiser.cjs).
 */
export { AdviceEngineModule } from './AdviceEngineModule';
