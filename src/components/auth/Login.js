import React, { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';
import { motion } from 'framer-motion';

const Login = ({ onSwitchToRegister }) => {
    const { login, loading } = useAuth();
    const {
        register,
        setValue,
        handleSubmit,
        formState: { errors },
        setError,
        watch, 
    } = useForm();
    const navigate = useNavigate();

    // State untuk toggle show/hide password
    const [showPassword, setShowPassword] = useState(false);

    const onSubmit = async (data) => {
        const result = await login(data);
        if (!result.success) {
            toast.error(result.message);
        } else {
            navigate('/dashboard'); // ⬅️ redirect ke dashboard
        }
    };

    useEffect(() => {
        const storedNIK = localStorage.getItem('nik');
        if (storedNIK) {
            setValue('nik', storedNIK);
        }
    }, [setValue]);

    // Konstanta & watch
    const NIK_LEN = 8;
    const nikVal = watch('nik') || '';
    const nikLen = nikVal.length;
    
    // Handler input: izinkan lewat 8 → toast + potong ke 8
    const handleNikInput = (e) => {
      let val = (e.target.value || '').replace(/\D/g, ''); // hanya angka
      if (val.length > NIK_LEN) {
        toast.error(`NIK maksimal ${NIK_LEN} digit`);
        val = val.slice(0, NIK_LEN);
      }
      e.target.value = val; // sinkron ke DOM
      setValue('nik', val, { shouldDirty: true, shouldTouch: true }); // sinkron ke RHF
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md mx-auto"
        >
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        NIK
                    </label>
                    <input
                                id="username"
                                type="text"
                                inputMode="numeric"
                                autoComplete="username"
                                placeholder="Masukkan NIK"
                                className={`w-full px-3 py-2 border rounded-lg focus:outline-none ${
                                    nikLen < NIK_LEN
                                    ? 'border-red-300 focus:ring-2 focus:ring-red-500'
                                    : 'border-gray-300 focus:ring-2 focus:ring-blue-500'
                                }`}
                                {...register('nik', {
                                    required: 'NIK harus diisi',
                                    validate: (v) => (/^\d{8}$/.test(v || '') ? true : 'NIK harus tepat 8 digit angka'),
                                })}
                                onInput={handleNikInput}
                                onKeyDown={(e) => {
                                    // opsional: cegah char non-angka; lebih aman tetap ada
                                    const blocked = ['e', 'E', '+', '-', '.', ','];
                                    if (blocked.includes(e.key)) e.preventDefault();
                                }}
                                />

                                {/* Helper dinamis */}
                                <div className="mt-1 flex items-center justify-end text-xs">
                                <span className={nikLen === NIK_LEN ? 'text-green-600' : 'text-gray-500'}>
                                    {nikLen}/{NIK_LEN} digit
                                </span>
                                </div>

                                {errors.nik && <p className="text-red-600">{errors.nik.message}</p>}
                            </div>

                <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Password
                    </label>
                    <input
                        type={showPassword ? 'text' : 'password'}
                        {...register('password', { required: 'Password harus diisi' })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Masukkan Password"
                    />
                    <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute top-9 right-3 text-gray-500 hover:text-gray-700 focus:outline-none"
                        tabIndex={-1} // supaya tidak fokus saat tab
                    >
                        {showPassword ? (
                            // icon mata terbuka (show)
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                        ) : (
                            // icon mata tertutup (hide)
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a10.086 10.086 0 012.162-3.384m1.386-1.386A9.966 9.966 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.958 9.958 0 01-1.012 2.168M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                            </svg>
                        )}
                    </button>
                    {errors.password && (
                        <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>
                    )}
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-gradient-to-r from-blue-500 to-purple-600 text-white py-2 px-4 rounded-lg hover:from-blue-600 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
                >
                    {loading ? 'Loading...' : 'Login'}
                </button>

                <div className="text-center">
                    <button
                        type="button"
                        onClick={onSwitchToRegister}
                        className="text-sm text-blue-600 hover:text-blue-500"
                    >
                        Belum punya akun? Daftar disini
                    </button>
                </div>
            </form>
        </motion.div>
    );
};

export default Login;
