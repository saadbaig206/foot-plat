"""Compatibility helper for unpickling models across different NumPy / Scikit-Learn versions."""
import sys


def apply_numpy_compat():
    try:
        import numpy.random._pickle as p
        from numpy.random._pcg64 import PCG64
        from numpy.random import Generator
        from numpy.random.bit_generator import BitGenerator

        class CompatPCG64(PCG64):
            def __setstate__(self, state):
                if isinstance(state, tuple):
                    for item in state:
                        if isinstance(item, dict) and "state" in item:
                            super().__setstate__(item)
                            return
                    if len(state) > 0 and isinstance(state[0], dict):
                        super().__setstate__(state[0])
                        return
                elif isinstance(state, dict):
                    super().__setstate__(state)

        CompatPCG64.__name__ = "PCG64"
        CompatPCG64.__qualname__ = "PCG64"
        p.BitGenerators[PCG64] = CompatPCG64
        p.BitGenerators["PCG64"] = CompatPCG64

        if not hasattr(p, "_original_generator_ctor"):
            p._original_generator_ctor = p.__generator_ctor

            def compat_generator_ctor(bit_generator_name="MT19937", bit_generator_ctor=p.__bit_generator_ctor):
                if isinstance(bit_generator_name, BitGenerator):
                    return Generator(bit_generator_name)
                return p._original_generator_ctor(bit_generator_name, bit_generator_ctor)

            p.__generator_ctor = compat_generator_ctor
    except Exception:
        pass
