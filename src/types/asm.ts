export type {
  RegisterName,
  FlagName,
  Flags,
  CPUState,
  DecodedInstruction,
  StepResult,
} from '../utils/asm';

export {
  GP_REGISTERS,
  REGISTER_ALIASES,
  registerBitWidth,
  createCPUState,
  readRegister,
  writeRegister,
  tokenize,
  execute,
} from '../utils/asm';
