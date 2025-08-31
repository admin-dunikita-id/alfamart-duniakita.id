import { Listbox, Transition } from "@headlessui/react";
import { Check, ChevronUpDown } from "lucide-react";
import React, { Fragment } from "react";

const Select = ({ value, onChange, options, placeholder = "Pilih" }) => {
    return (
        <Listbox value={value} onChange={onChange}>
            <div className="relative w-48">
                <Listbox.Button className="relative w-full cursor-pointer rounded-lg border bg-white py-2 pl-3 pr-10 text-left shadow focus:outline-none sm:text-sm">
                    <span className="block truncate">
                        {options.find((o) => o.value === value)?.label || placeholder}
                    </span>
                    <span className="absolute inset-y-0 right-0 flex items-center pr-2">
                        <ChevronUpDown className="h-5 w-5 text-gray-400" />
                    </span>
                </Listbox.Button>
                <Transition
                    as={Fragment}
                    leave="transition ease-in duration-100"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <Listbox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md border bg-white py-1 text-sm shadow-lg">
                        {options.map((option) => (
                            <Listbox.Option
                                key={option.value}
                                className={({ active }) =>
                                    `relative cursor-pointer select-none py-2 pl-10 pr-4 ${active ? "bg-blue-100 text-blue-700" : "text-gray-900"
                                    }`
                                }
                                value={option.value}
                            >
                                {({ selected }) => (
                                    <>
                                        <span className={`block truncate ${selected ? "font-medium" : "font-normal"}`}>
                                            {option.label}
                                        </span>
                                        {selected ? (
                                            <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-blue-600">
                                                <Check className="h-5 w-5" />
                                            </span>
                                        ) : null}
                                    </>
                                )}
                            </Listbox.Option>
                        ))}
                    </Listbox.Options>
                </Transition>
            </div>
        </Listbox>
    );
};

export default Select;
