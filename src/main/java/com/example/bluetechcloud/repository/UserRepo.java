package com.example.bluetechcloud.repository;

import com.example.bluetechcloud.entity.UserEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepo extends JpaRepository<UserEntity,Long> {


    UserEntity findByUsername(String username);

    UserEntity findByRememberToken(String rememberToken);
}

