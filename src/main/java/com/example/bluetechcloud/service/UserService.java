package com.example.bluetechcloud.service;

import com.example.bluetechcloud.entity.UserEntity;
import com.example.bluetechcloud.model.UserDTO;
import com.example.bluetechcloud.repository.UserRepo;
import org.springframework.stereotype.Service;

@Service
public class UserService {


    private final UserRepo userRepo;

    public UserService(UserRepo userRepo) {
        this.userRepo = userRepo;
    }

    public UserDTO loginCheck(String id, String password) {

        UserEntity dto = userRepo.findByUsername(id);

        if(dto == null){
            return null;
        }else if(!dto.getPassword().equals(password)){
            return null;
        }else {

            UserDTO userDTO = new UserDTO();

            userDTO.setId(dto.getId());
            userDTO.setUsername(dto.getUsername());
            userDTO.setPassword(dto.getPassword());
            userDTO.setName(dto.getName());
            userDTO.setRole(dto.getRole());
            userDTO.setCreated_at(dto.getCreatedAt());

            return userDTO;
        }

    }
}
